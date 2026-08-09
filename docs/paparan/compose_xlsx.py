"""Compose the XLSX sheets into one deck image.

Pages are located by the text on them rather than hard-coded numbers: adding a
column repaginates the workbook, and a fixed page list then silently shows the
wrong sheet.
"""
import subprocess, sys
from PIL import Image, ImageDraw, ImageFont

S, SRC_PDF = sys.argv[1], sys.argv[2]


def page_text(i):
    return subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), SRC_PDF, "-"],
                          capture_output=True, text=True).stdout


WANT = [
    ("Ringkasan", lambda t: "Keterangan" in t and "Awal jendela" in t),
    ("Per Gate", lambda t: "Tanpa arah" in t),
    ("Per Nomor Lambung", lambda t: "Nomor Lambung" in t and "Stat" in t),
    ("Belum Berpasangan", lambda t: "Waktu lintasan" in t and "Arah" in t),
]
texts = {i: page_text(i) for i in range(1, 10)}
picked = []
for label, test in WANT:
    hit = next((i for i, t in texts.items() if test(t)), None)
    if hit is None:
        print(f"  !! sheet not found: {label}")
        continue
    picked.append((label, hit))
    print(f"  {label} -> page {hit}")

PAD, GAP, CAP = 18, 26, 30
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
except OSError:
    font = ImageFont.load_default()

crops = []
for label, page in picked:
    im = Image.open(f"{S}/xlsxpage-{page}.png").convert("RGB")
    bbox = im.convert("L").point(lambda p: 255 if p < 245 else 0).getbbox()
    x0, y0, x1, y1 = bbox
    crops.append((label, im.crop((max(0, x0 - 4), max(0, y0 - 4), x1 + 4, y1 + 4))))

width = max(c.width for _, c in crops) + PAD * 2
height = PAD + sum(CAP + c.height + GAP for _, c in crops)
canvas = Image.new("RGB", (width, height), "white")
draw = ImageDraw.Draw(canvas)
y = PAD
for label, crop in crops:
    draw.text((PAD, y), f"Sheet: {label}", fill=(20, 30, 48), font=font)
    y += CAP
    canvas.paste(crop, (PAD, y))
    y += crop.height + GAP
canvas.save(f"{S}/deck-shots/11-excel-isi.png")
print("wrote 11-excel-isi.png", canvas.size)
