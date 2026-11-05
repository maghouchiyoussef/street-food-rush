"""Builds the app icon, splash screen and title-screen chef from the chef artwork.
Usage: python3 tools/make_icons.py path/to/chef.png
The chef artwork is our own (generated with Higgsfield, see CREDITS.md).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
BG_IN, BG_OUT = (255, 198, 46), (232, 65, 47)
INK = (43, 24, 64)


def cutout(img):
    """Removes the plain light-gray studio background (flood fill from the borders)."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    ref = px[2, 2][:3]
    seen = bytearray(w * h)
    stack = [(x, y) for x in range(0, w, 4) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 4) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        r, g, b, _ = px[x, y]
        if abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) > 42 or max(r, g, b) - min(r, g, b) > 18:
            continue
        px[x, y] = (r, g, b, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # background enclosed between the legs (not reached by the flood fill)
    for y in range(int(h * 0.6), h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al and abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) < 30 and max(r, g, b) - min(r, g, b) < 12:
                px[x, y] = (r, g, b, 0)
    # floor shadow under the shoes: light, unsaturated pixels in the bottom rows
    for y in range(int(h * 0.88), h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al and max(r, g, b) - min(r, g, b) < 22 and min(r, g, b) > 105 and max(r, g, b) < 228:
                px[x, y] = (r, g, b, 0)
    a = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    img.putalpha(a)
    return img.crop(img.getbbox())


def radial(size):
    img = Image.new('RGB', (size, size), BG_OUT)
    d = ImageDraw.Draw(img)
    for i in range(60, 0, -1):
        t = i / 60
        c = tuple(int(BG_IN[k] + (BG_OUT[k] - BG_IN[k]) * t) for k in range(3))
        r = size * 0.75 * t
        d.ellipse((size / 2 - r, size * 0.42 - r, size / 2 + r, size * 0.42 + r), fill=c)
    # sun-ray stripes
    return img


def icon(chef, size):
    base = radial(size).convert('RGBA')
    head = chef.crop((0, 0, chef.width, int(chef.height * 0.56)))
    s = size * 0.98 / head.width
    head = head.resize((int(head.width * s), int(head.height * s)), Image.LANCZOS)
    shadow = Image.new('RGBA', head.size, (0, 0, 0, 0))
    shadow.putalpha(head.getchannel('A').point(lambda v: v * 0.35))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size / 60)), ((size - head.width) // 2, int(size * 0.14)))
    base.alpha_composite(head, ((size - head.width) // 2, int(size * 0.1)))
    return base


def rounded(img, r):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, *img.size), r, fill=255)
    out = img.copy(); out.putalpha(m); return out


def circle(img):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, *img.size), fill=255)
    out = img.copy(); out.putalpha(m); return out


chef = cutout(Image.open(sys.argv[1]))
(ROOT / 'www/img').mkdir(parents=True, exist_ok=True)
t = chef.resize((560, int(chef.height * 560 / chef.width)), Image.LANCZOS)
t.save(ROOT / 'www/img/chef.png', optimize=True)

store = ROOT / 'store'; store.mkdir(exist_ok=True)
icon(chef, 512).convert('RGB').save(store / 'icon-512.png')

SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for name, legacy in SIZES.items():
    big = icon(chef, legacy * 4).resize((legacy, legacy), Image.LANCZOS)
    rounded(big, legacy * 0.18).save(RES / f'mipmap-{name}/ic_launcher.png')
    circle(big).save(RES / f'mipmap-{name}/ic_launcher_round.png')
    fg_size = int(legacy * 2.25)
    fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    inner = icon(chef, int(fg_size * 0.62))
    fg.alpha_composite(circle(inner), ((fg_size - inner.width) // 2, (fg_size - inner.height) // 2))
    fg.save(RES / f'mipmap-{name}/ic_launcher_foreground.png')

for path in sorted(RES.glob('drawable*/splash.png')):
    w, h = Image.open(path).size
    bg = radial(max(w, h)).crop((0, 0, w, h)).convert('RGBA')
    c = chef.resize((int(min(w, h) * 0.5), int(chef.height * min(w, h) * 0.5 / chef.width)), Image.LANCZOS)
    bg.alpha_composite(c, ((w - c.width) // 2, max(0, (h - c.height) // 2)))
    bg.convert('RGB').save(path)

bgxml = RES / 'values/ic_launcher_background.xml'
if bgxml.exists():
    bgxml.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#E8412F</color>\n</resources>\n')
print('icons done')
