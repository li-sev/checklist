#!/usr/bin/env python3
"""生成奏事处的图标：朱红御印，米色「奏」字。楷体借 Windows 字体。"""
from PIL import Image, ImageDraw, ImageFont

RED   = (155, 45, 32)      # --accent
CREAM = (253, 243, 224)
FONT  = "/mnt/c/Windows/Fonts/simkai.ttf"


def make(size, pad_ratio=0.0, out="icon.png"):
    """pad_ratio > 0 时四周留白，给 maskable 用（iOS 会自己切圆角，普通图标不留白）。"""
    S = size * 4                      # 4 倍超采样再缩，边缘干净
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    pad = int(S * pad_ratio)
    box = (pad, pad, S - pad - 1, S - pad - 1)
    r = int((S - 2 * pad) * 0.16)

    # 印身
    d.rounded_rectangle(box, radius=r, fill=RED)
    # 内圈细边，像印章的边框
    inset = int((S - 2 * pad) * 0.075)
    d.rounded_rectangle(
        (box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset),
        radius=int(r * 0.7), outline=CREAM, width=max(2, int(S * 0.012)),
    )

    # 「奏」字
    side = box[2] - box[0]
    f = ImageFont.truetype(FONT, int(side * 0.52))
    l, t, rr, b = d.textbbox((0, 0), "奏", font=f)
    d.text(
        ((box[0] + box[2]) / 2 - (l + rr) / 2, (box[1] + box[3]) / 2 - (t + b) / 2),
        "奏", font=f, fill=CREAM,
    )

    im.resize((size, size), Image.LANCZOS).save(out)
    print("写出", out, size)


make(192, 0.0, "icon-192.png")
make(512, 0.0, "icon-512.png")
make(512, 0.14, "icon-maskable-512.png")   # Android 自适应图标要留安全区
make(180, 0.0, "apple-touch-icon.png")     # iOS 加到主屏幕用这张
