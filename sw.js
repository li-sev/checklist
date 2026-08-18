/* 奏事处的离线缓存。
 *
 * 出新版本时把 VERSION 加一，旧缓存会在 activate 里清掉。
 * 页面本身走网络优先（3 秒不回就退回缓存），其余资源走缓存优先、后台刷新。
 * 新 worker 装好即 skipWaiting 顶上，页面那边收到 controllerchange 自己重载；
 * 手上正开着对话框或正在打字就先记着，等你手一停再换。
 */
const VERSION = "v54";
const CACHE = "zoushichu-" + VERSION;

const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", e => {
  /* 装好就顶上，不在 waiting 里干等。
     原先是等页面弹「新版已到」、用户点了才换，结果多次出现「怎么没更新」——
     提示没弹到、或者点了「待会儿」，旧 worker 就一直霸着，页面永远是旧的。
     现在页面本身走网络优先、内容每改一下就落盘，换 worker 不会丢东西。 */
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;   // 本来就没有外部资源，保险起见

  const isDoc = req.mode === "navigate" || req.destination === "document";

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    /* 页面本身走「有网优先」：改了新版，一联网打开就是新的，
       不用等 sw 那套「新版已到」的通知。3 秒还没回来就退回缓存，
       断网、信号差照样秒开。 */
    if (isDoc){
      const net = fetch(req, { cache: "no-store" }).then(res => {
        if (res && res.ok) cache.put("./index.html", res.clone());
        return res;
      }).catch(() => null);
      const timeout = new Promise(r => setTimeout(() => r(null), 3000));
      const res = await Promise.race([net, timeout]);
      if (res && res.ok) return res;
      return (await cache.match("./index.html")) || (await cache.match("./")) || (await net) || Response.error();
    }

    const hit = await cache.match(req, { ignoreSearch: true });

    // 后台取新的。取到就更新缓存，下次打开即是新版。
    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (hit) return hit;                       // 有缓存先用缓存，断网也不怕
    const res = await fresh;
    if (res) return res;
    // 彻底没网又没缓存：导航请求兜到首页
    if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
    return Response.error();
  })());
});
