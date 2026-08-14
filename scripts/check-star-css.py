#!/usr/bin/env python3
"""Checks src/star-ripple.css by rendering it, not by trusting the generator.

Parses the emitted @keyframes, evaluates the cubics, and includes the midpoints
a browser produces by linearly interpolating control points between keyframes.
Then asks the only question that matters: is any of this a rigid rotation of the
first frame? A single travelling wave scores 0.000 and reads as a spinning star.

    PYENV_VERSION=3.10 python3 scripts/check-star-css.py
"""
import math
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "src", "star-ripple.css")
OUT_DIR = os.path.join(ROOT, "tmp-star")
CENTRE = 50.0
# Enough points per cubic that the resampled profile below is never sparser than
# its bins; undersample it and the staircase reads as extra points on the star.
PER_SEGMENT = 16
BINS = 360
BG = (255, 255, 255)
FILL = (23, 2, 252)


def parse_paths():
    css = open(CSS).read()
    block = re.search(r"@keyframes star-ripple \{(.*?)\n\}", css, re.S)
    if not block:
        sys.exit("no @keyframes star-ripple in " + CSS)

    frames = []
    for pct, d in re.findall(r"([\d.]+)% \{\s*d: path\(\"([^\"]+)\"\)", block.group(1)):
        nums = [float(n) for n in re.findall(r"-?[\d.]+", d)]
        start, rest = nums[:2], nums[2:]
        if len(rest) % 6:
            sys.exit("path is not a whole number of cubics")
        frames.append((float(pct), start, [rest[i : i + 6] for i in range(0, len(rest), 6)]))
    return frames


def lerp(a, b, u):
    return [x + (y - x) * u for x, y in zip(a, b)]


def blend(f0, f1, u):
    _, s0, c0 = f0
    _, s1, c1 = f1
    return lerp(s0, s1, u), [lerp(a, b, u) for a, b in zip(c0, c1)]


def polygon(frame):
    start, segments = frame
    pts = []
    cur = start
    for seg in segments:
        p0, c1, c2, p1 = cur, seg[0:2], seg[2:4], seg[4:6]
        for s in range(PER_SEGMENT):
            u = s / PER_SEGMENT
            v = 1 - u
            pts.append(
                tuple(
                    v**3 * p0[i] + 3 * v * v * u * c1[i] + 3 * v * u * u * c2[i] + u**3 * p1[i]
                    for i in range(2)
                )
            )
        cur = p1
    return pts


def radial_profile(pts, bins=BINS):
    """Resample the outline as r(theta) so frames can be compared under rotation."""
    prof = [None] * bins
    for x, y in pts:
        dx, dy = x - CENTRE, y - CENTRE
        b = int((math.atan2(dy, dx) % (2 * math.pi)) / (2 * math.pi) * bins) % bins
        r = math.hypot(dx, dy)
        prof[b] = r if prof[b] is None else max(prof[b], r)
    last = next(v for v in prof if v is not None)
    for i, v in enumerate(prof):
        if v is None:
            prof[i] = last
        else:
            last = v
    mean = sum(prof) / bins
    return [v - mean for v in prof]


def rotation_residual(profiles):
    base = profiles[0]
    n = len(base)
    scale = sum(v * v for v in base)
    worst = 0.0
    for cur in profiles[1:]:
        best = min(
            sum((cur[i] - base[(i - shift) % n]) ** 2 for i in range(n)) for shift in range(n)
        )
        worst = max(worst, math.sqrt(best / scale))
    return worst


def peaks(profile, k):
    n = len(profile)
    half = max(2, n // (2 * (k + 3)))
    return [
        v
        for i, v in enumerate(profile)
        if v > 0 and all(v >= profile[(i + j) % n] for j in range(-half, half + 1))
    ]


def lobes(profile, k):
    return len(peaks(profile, k))


def evenness(profiles, k):
    """Shallowest point over deepest, worst frame. Matches the lab's metric,
    including skipping frames where the rim has gone nearly flat — a fully
    inverting mode passes through zero depth, and picking peaks out of a flat
    profile measures rounding noise rather than the shape."""
    depths = [max(p) - min(p) for p in profiles]
    floor = 0.2 * max(depths)
    worst = 1.0
    for prof, depth in zip(profiles, depths):
        if depth < floor:
            continue
        found = peaks(prof, k)
        if len(found) > 1:
            worst = min(worst, min(found) / max(found))
    return worst


def antiphase(profiles):
    """0.00 means every crest has a matching trough directly across the circle.
    Free for shapes built only from odd wavenumbers, broken by any even one."""
    worst = 0.0
    for prof in profiles:
        n = len(prof)
        energy = sum(v * v for v in prof)
        if energy < 1e-9:
            continue
        mirrored = sum((v + prof[(i + n // 2) % n]) ** 2 for i, v in enumerate(prof))
        worst = max(worst, math.sqrt(mirrored / energy))
    return worst


def draw(pts, size, ss=4):
    img = Image.new("RGB", (size * ss, size * ss), BG)
    k = size * ss / 100.0
    ImageDraw.Draw(img).polygon([(x * k, y * k) for x, y in pts], fill=FILL)
    return img.resize((size, size), Image.LANCZOS)


def main():
    frames = parse_paths()
    print(f"{len(frames)} keyframes, {len(frames[0][2])} cubics each")

    # Keyframes plus the browser's in-betweens; drop 100% as it repeats 0%.
    rendered = []
    for i in range(len(frames) - 1):
        for u in (0.0, 0.5):
            rendered.append(polygon(blend(frames[i], frames[i + 1], u)))

    points = int(os.environ.get("STAR_POINTS", "11"))
    profiles = [radial_profile(p) for p in rendered]
    amps = [max(p) - min(p) for p in profiles]
    residual = rotation_residual(profiles)
    counts = {lobes(p, points) for p in profiles}

    print(f"peak-to-peak wave depth: {min(amps):.2f}–{max(amps):.2f} of 42 units")
    print(f"lobes per frame: {min(counts)}–{max(counts)}")
    print("the three numbers on the lab card, measured off the shipped CSS:")
    print(f"  residual  {residual:.2f}   (0.00 = a spinning star)")
    print(f"  even      {evenness(profiles, points):.2f}   (1.00 = every point identical)")
    print(f"  antiphase {antiphase(profiles):.2f}   (0.00 = crest opposite trough)")

    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (40, 96):
        shown = rendered[:: max(1, len(rendered) // 12)][:12]
        cell = size + size // 8
        strip = Image.new("RGB", (cell * len(shown), cell), BG)
        for i, pts in enumerate(shown):
            strip.paste(draw(pts, size), (i * cell, 0))
        zoom = 6 if size == 40 else 2
        strip = strip.resize((strip.width * zoom, strip.height * zoom), Image.NEAREST)
        path = os.path.join(OUT_DIR, f"shipped-{size}px.png")
        strip.save(path)
        print("wrote", path)

    if residual < 0.2:
        sys.exit(f"FAIL: residual {residual:.3f} — this is a rotation, not a ripple")


if __name__ == "__main__":
    main()
