"""
test_upload.py — Standalone upload test for FinishPics.

Does NOT require FinishLynx or a LIF file.
Generates a synthetic photo-finish-like image using Pillow and uploads it
with sample metadata to the configured API endpoint.

Usage:
    python test_upload.py
"""

import configparser
import io
import logging
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from uploader import upload_heat

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Synthetic image generation
# ---------------------------------------------------------------------------

def _random_gray(lo: int = 30, hi: int = 220) -> int:
    return random.randint(lo, hi)


def create_synthetic_finish_image(width: int = 2000, height: int = 200) -> bytes:
    """
    Generate a synthetic photo-finish strip image.

    Layout:
    - Black background
    - Many vertical gray/white scan lines (mimicking the vertical slice-scan
      nature of photo-finish cameras)
    - A few colored "athlete silhouette" columns at different x positions

    Returns JPEG bytes.
    """
    rng = random.Random(42)  # fixed seed for reproducibility

    img = Image.new('RGB', (width, height), color=(0, 0, 0))
    draw = ImageDraw.Draw(img)

    # --- Background scan-line texture ---
    # Photo-finish cameras capture one vertical column per clock tick;
    # the result looks like many thin vertical stripes of varying brightness.
    for x in range(0, width, 1):
        # Slight random luminance variation to simulate the track surface
        lum = rng.randint(8, 40)
        draw.line([(x, 0), (x, height - 1)], fill=(lum, lum, lum))

    # --- Track lane markers (faint horizontal bands) ---
    num_lanes = 8
    lane_height = height // num_lanes
    for lane in range(num_lanes):
        y_top = lane * lane_height
        y_bot = y_top + lane_height - 1
        # Alternating slightly lighter/darker bands
        band_lum = 25 if lane % 2 == 0 else 18
        for x in range(width):
            lum = rng.randint(band_lum - 5, band_lum + 5)
            draw.point((x, y_top), fill=(lum, lum, lum))
            draw.point((x, y_bot), fill=(lum, lum, lum))

    # --- Athlete silhouettes ---
    # 3 athletes at different x positions with different colored jerseys
    athlete_colors = [
        (220, 30, 30),   # red jersey  — 1st
        (30, 80, 220),   # blue jersey — 2nd
        (30, 180, 60),   # green jersey — 3rd
    ]
    # Spread athletes across the image: winner at left (earlier time), rest to the right
    athlete_x_centers = [
        int(width * 0.18),
        int(width * 0.42),
        int(width * 0.71),
    ]
    athlete_widths = [18, 16, 14]  # slightly narrower silhouette = slightly behind

    for color, cx, aw in zip(athlete_colors, athlete_x_centers, athlete_widths):
        # Torso + legs silhouette as a simple vertical column block
        torso_top = height // 5
        torso_bot = int(height * 0.75)
        leg_bot = height - 5

        # Legs (darker shade of jersey)
        leg_color = (color[0] // 2, color[1] // 2, color[2] // 2)
        draw.rectangle(
            [(cx - aw // 3, torso_bot), (cx + aw // 3, leg_bot)],
            fill=leg_color,
        )
        # Torso
        draw.rectangle(
            [(cx - aw // 2, torso_top), (cx + aw // 2, torso_bot)],
            fill=color,
        )
        # Head (skin tone)
        head_r = aw // 3
        head_cy = torso_top - head_r - 2
        draw.ellipse(
            [(cx - head_r, head_cy - head_r), (cx + head_r, head_cy + head_r)],
            fill=(210, 170, 130),
        )

        # Scan-line overlay on the silhouette to keep the photo-finish look
        for x in range(cx - aw // 2, cx + aw // 2 + 1):
            if 0 <= x < width:
                if rng.random() < 0.15:  # occasional bright scan line
                    for y in range(torso_top, torso_bot):
                        r = min(255, color[0] + 40)
                        g = min(255, color[1] + 40)
                        b = min(255, color[2] + 40)
                        draw.point((x, y), fill=(r, g, b))

    # --- Finish line (bright vertical white stripe at the very left edge) ---
    for y in range(height):
        draw.point((0, y), fill=(255, 255, 255))
        draw.point((1, y), fill=(230, 230, 230))

    # --- Convert to JPEG bytes ---
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=90)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Sample metadata
# ---------------------------------------------------------------------------

SAMPLE_METADATA = {
    'meet_name': 'TEST — Spring Invitational 2026',
    'meet_date': '2026-06-06',
    'event_num': '99',
    'round': 'F',
    'heat': '1',
    'first_frame_time': 10.50,
    'last_frame_time': 11.80,
    'athletes': [
        {
            'place': 1,
            'bib': '101',
            'first_name': 'John',
            'last_name': 'Smith',
            'team': 'Westfield HS',
            'finish_time': 10.84,
        },
        {
            'place': 2,
            'bib': '205',
            'first_name': 'Marcus',
            'last_name': 'Jones',
            'team': 'Riverside AC',
            'finish_time': 10.91,
        },
        {
            'place': 3,
            'bib': '317',
            'first_name': 'Alejandro',
            'last_name': 'Rivera',
            'team': 'Central Track Club',
            'finish_time': 11.07,
        },
    ],
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print()
    print('╔══════════════════════════════════════════════════════════╗')
    print('║       FinishPics — Standalone Upload Test                ║')
    print('╚══════════════════════════════════════════════════════════╝')
    print()

    # Load config
    config_path = Path(__file__).parent / 'config.ini'
    if not config_path.exists():
        logger.error("config.ini not found at %s", config_path)
        logger.error("Copy config.ini.example to config.ini and fill in your settings.")
        sys.exit(1)

    cfg = configparser.ConfigParser()
    cfg.read(config_path, encoding='utf-8')

    api_url = cfg.get('api', 'url')
    api_key = cfg.get('api', 'key')

    logger.info("API endpoint: %s/api/upload", api_url)
    logger.info("Generating synthetic photo-finish image (2000x200)...")

    image_bytes = create_synthetic_finish_image(width=2000, height=200)
    logger.info("Image generated: %d bytes", len(image_bytes))

    # Write to a temp file so upload_heat() can read it by path
    tmp_path = Path(__file__).parent / '_test_image_99-F-1.jpg'
    tmp_path.write_bytes(image_bytes)
    logger.info("Temp image written to: %s", tmp_path)

    logger.info("Uploading with sample metadata (Event 99, Final, Heat 1)...")
    logger.info("Athletes: %s", [
        f"{a['first_name']} {a['last_name']}" for a in SAMPLE_METADATA['athletes']
    ])

    success = upload_heat(api_url, api_key, SAMPLE_METADATA, str(tmp_path))

    # Clean up temp file
    try:
        tmp_path.unlink()
        logger.debug("Temp image deleted: %s", tmp_path)
    except OSError:
        pass

    print()
    if success:
        print('  Result: UPLOAD SUCCEEDED')
        print()
        print(f'  If upload succeeded, visit {api_url} and search for \'Smith\' to find the test photo.')
    else:
        print('  Result: UPLOAD FAILED — check the API URL, key, and server logs above.')
    print()


if __name__ == '__main__':
    main()
