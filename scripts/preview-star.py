#!/usr/bin/env python3
"""Renders candidate rim-wave models to a filmstrip and measures how much of
each frame is explained by a rigid rotation of frame 0.

A pure travelling wave on a ring is *identically* a rigid rotation, so the
residual below is the whole question: near zero means the eye will read a
spinning star no matter how the maths is phrased.

    PYENV_VERSION=3.10 python3 scripts/preview-star.py
"""
import math
import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp-star")
TILE = 128
SS = 4
FRAMES = 12
FINE = 720
BG = (255, 255, 255)
FILL = (23, 2, 252)


SKEW = 0.15


def sum_waves(waves, skew=0.0):
    total = sum(a for _, a, _ in waves)
    mean_square = sum(a * a for _, a, _ in waves) / 2

    def f(theta, t):
        v = sum(a * math.cos(k * theta - 2 * math.pi * c * t) for k, a, c in waves)
        return v - skew * (v * v - mean_square) / total

    return f


# Every model that decided something, so the reasoning stays re-runnable.
MODELS = [
    # Rejected: one wavenumber can only rotate, whatever the maths is called.
    ("A one wave", sum_waves([(11, 0.09, 1)])),
    # Rejected: ripples, but the far-flung wavenumbers make the points uneven.
    ("B 11/7/5", sum_waves([(11, 0.055, 3), (7, 0.040, -2), (5, 0.025, 1)])),
    # Rejected: flankers summing to the carrier leave a bald arc where they cancel.
    ("C flat spots", sum_waves([(11, 0.058, 2), (10, 0.033, -1), (12, 0.024, 1)], SKEW)),
    # Shipped.
    ("D 11/10/12", sum_waves([(11, 0.072, 2), (10, 0.025, -1), (12, 0.018, 1)], SKEW)),
]

# The buttons on screen. Whatever the maths says, the ripple has to survive
# being 40 CSS pixels across.
REAL_SIZES = [36, 40, 48]


def profile(f, t, n=FINE):
    return [f(2 * math.pi * i / n, t) for i in range(n)]


def rotation_residual(f):
    """Best-fit rigid rotation of frame 0 onto each frame, as a fraction of the
    wave's own amplitude. 0 = pure rotation, 1 = rotation explains nothing."""
    base = profile(f, 0.0)
    n = len(base)
    worst = 0.0
    for k in range(1, FRAMES):
        t = k / FRAMES
        cur = profile(f, t)
        best = min(
            sum((cur[i] - base[(i - shift) % n]) ** 2 for i in range(n))
            for shift in range(n)
        )
        scale = sum(v * v for v in base)
        worst = max(worst, math.sqrt(best / scale))
    return worst


def draw(f, t, size):
    img = Image.new("RGB", (size * SS, size * SS), BG)
    d = ImageDraw.Draw(img)
    c = size * SS / 2
    r0 = c * 0.80
    pts = []
    for i in range(FINE):
        theta = 2 * math.pi * i / FINE
        r = r0 * (1 + f(theta, t))
        pts.append((c + r * math.cos(theta), c + r * math.sin(theta)))
    d.polygon(pts, fill=FILL)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    strip = Image.new("RGB", (TILE * FRAMES, TILE * len(MODELS)), BG)
    for row, (name, f) in enumerate(MODELS):
        for k in range(FRAMES):
            strip.paste(draw(f, k / FRAMES, TILE), (k * TILE, row * TILE))
        print(f"{name:22s} rigid-rotation residual {rotation_residual(f):.3f}")
    path = os.path.join(OUT_DIR, "filmstrip.png")
    strip.save(path)
    print("wrote", path)

    # Same models at the sizes they actually ship at, magnified 6x with no
    # smoothing so the real pixel grid is what gets judged.
    zoom, pad, shown = 6, 6, 8
    for size in REAL_SIZES:
        cell = size + pad
        real = Image.new("RGB", (cell * shown, cell * len(MODELS)), BG)
        for k in range(shown):
            for row, (_, f) in enumerate(MODELS):
                real.paste(draw(f, k / shown, size), (k * cell, row * cell))
        real = real.resize((real.width * zoom, real.height * zoom), Image.NEAREST)
        path = os.path.join(OUT_DIR, f"actual-{size}px.png")
        real.save(path)
        print("wrote", path, real.size)


if __name__ == "__main__":
    main()
