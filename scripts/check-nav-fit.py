#!/usr/bin/env python3
"""
Checks the page switcher still fits the sidebar band on one line.

Exists because the first attempt sized this band from invented character widths
— "274px against a 280px budget" — when the real figure was 55px over, and the
nav ended up under the search field. Reads the shipped values back out of
index.css and TopBar.tsx and measures the labels against the actual font file,
so it fails if any of them drift apart.

    pip3 install fonttools brotli
    python3 scripts/check-nav-fit.py
"""
from fontTools.ttLib import TTFont
import re, pathlib, sys

css = pathlib.Path('src/index.css').read_text()
top = pathlib.Path('src/components/layout/TopBar.tsx').read_text()

def css_px(block, prop):
    m = re.search(re.escape(block) + r'[^}]*' + prop + r':\s*0?\s*([\d.]+)px', css, re.S)
    return float(m.group(1))

nav_font = css_px('.pill--nav {', 'font-size')
nav_pad = float(re.search(r'\.pill--nav \.marquee__static \{\s*padding: 0 ([\d.]+)px', css).group(1))
band = int(re.search(r'w-(\d+) flex-shrink-0 pl-5 pr-3', top).group(1)) * 4
home = int(re.search(r'size="w-(\d+) h-\d+"', top).group(1)) * 4
gap = float(re.search(r'items-center gap-([\d.]+) pointer-events-auto', top).group(1)) * 4

f = TTFont('public/fonts/space-grotesk-latin.woff2')
upem, cmap, hmtx = f['head'].unitsPerEm, f.getBestCmap(), f['hmtx']
w = lambda t: sum(hmtx[cmap[ord(c)]][0] for c in t) / upem * nav_font * 1.02

labels = ['Spaces', 'Projects', 'Canvases']
nav = sum(w(l) + nav_pad * 2 for l in labels) + gap * (len(labels) - 1)
used = home + gap + nav
inner = band - 20 - 12
wide = home + gap + sum(w(l) * 1.08 + nav_pad * 2 for l in labels) + gap * 2

print(f'read from source: band {band}px, home {home}px, nav {nav_font}px/{nav_pad}px pad, gap {gap}px')
print(f'  needs {used:.1f}px, band has {inner}px  -> slack {inner - used:.1f}px')
print(f'  with an 8% wider fallback face -> slack {inner - wide:.1f}px')
ok = inner - wide > 0
print('  ONE LINE, with margin' if ok else '  WOULD WRAP')
sys.exit(0 if ok else 1)
