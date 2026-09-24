"""Prepare web-optimised copies of the original TuneForge artwork.

    python scripts/prepare_assets.py           # images only; runs offline
    python scripts/prepare_assets.py --fonts   # also re-download Inter and its licence

Only needed when the source artwork changes. The site, its build and its tests never need Python.
"""
from pathlib import Path
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'

# Every showcase poster shares one layout: a 600 x 1300 screen at this position inside a drawn phone.
# Cropping to the bare screen lets the site present each one in its own device frame and typography.
SCREEN_BOX = (300, 342, 900, 1642)
SCREENS = {
    '01-tuner': 'tuner', '02-pitch-feedback': 'pitch-feedback', '03-guitar-tunings': 'guitar-tunings',
    '04-alternate-tunings': 'alternate-tunings', '05-bass-tunings': 'bass-tunings', '06-custom-tuning': 'custom-tuning',
    '07-toolkit': 'toolkit', '08-metronome': 'metronome', '09-metronome-pulse': 'metronome-pulse', '10-appearance': 'appearance',
}
TOOLS = ('metronome', 'fretcalculator', 'drone', 'stringtension', 'capotransposer', 'chordshapes')
HERO_WIDE_WIDTHS = (1280, 1920, 2560, 3840)
HERO_TALL_WIDTHS = (800, 1200)


def webp(image, path, quality):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', quality=quality, method=6)
    print(f'{path.relative_to(ROOT)}  {image.width}x{image.height}  {path.stat().st_size // 1024} KB')


def images():
    # hero.png is the full-resolution master (16:9). The page positions its status pill and glow
    # as percentages of the dial, so every crop below keeps the master's composition exactly.
    Image.MAX_IMAGE_PIXELS = None
    hero = Image.open(ROOT / 'hero.png').convert('RGB')
    for width in HERO_WIDE_WIDTHS:
        size = (width, round(width * 9 / 16))
        webp(hero if hero.size == size else hero.resize(size, Image.LANCZOS), ASSETS / f'hero/hero-wide-{width}.webp', 80)
    # Portrait art direction for phones: the full height, centred on the dial (800:941 frame).
    left = round(hero.width * 0.42763)
    tall = hero.crop((left, 0, left + round(hero.height * 800 / 941), hero.height))
    for width in HERO_TALL_WIDTHS:
        webp(tall.resize((width, round(width * 941 / 800)), Image.LANCZOS), ASSETS / f'hero/hero-tall-{width}.webp', 82)

    for source, name in SCREENS.items():
        poster = Image.open(ASSETS / 'Showcase' / f'{source}.png').convert('RGB')
        webp(poster.crop(SCREEN_BOX), ASSETS / 'screens' / f'{name}.webp', 88)

    for name in TOOLS:
        art = Image.open(ASSETS / f'tool_{name}_image.png').convert('RGB')
        webp(art.resize((720, 960), Image.LANCZOS), ASSETS / 'tools' / f'{name}.webp', 84)

    mark = Image.open(ASSETS / 'Firefly.png').convert('RGBA')
    webp(mark.resize((144, 145), Image.LANCZOS), ASSETS / 'brand.webp', 92)
    icon = Image.open(ASSETS / 'app-icon.png').convert('RGBA')
    webp(icon.resize((256, 256), Image.LANCZOS), ASSETS / 'app-icon-256.webp', 90)
    icon.resize((180, 180), Image.LANCZOS).save(ASSETS / 'apple-touch-icon.png', optimize=True)
    icon.resize((64, 64), Image.LANCZOS).save(ASSETS / 'favicon.png', optimize=True)


def fonts():
    import re
    import requests

    def fetch(url):
        response = requests.get(url, timeout=35, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/133.0 Safari/537.36'})
        response.raise_for_status()
        return response.content

    css = fetch('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap').decode()
    (ASSETS / 'fonts/inter.woff2').write_bytes(fetch(re.findall(r'url\((https://[^)]+)\)', css)[-1]))
    (ASSETS / 'fonts/inter-LICENSE.txt').write_bytes(fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt'))
    print('Downloaded Inter and its licence.')


if __name__ == '__main__':
    images()
    if '--fonts' in sys.argv:
        fonts()
