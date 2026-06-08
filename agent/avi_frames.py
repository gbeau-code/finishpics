"""
avi_frames.py — Extract individual JPEG frames from an MJPEG AVI file.

IdentiLynx exports AVI files using MJPEG codec, where every video frame is
a self-contained JPEG stored inside a RIFF chunk.  We locate frames by
scanning for JPEG SOI markers (FF D8 FF) and find the matching EOI (FF D9).

No third-party libraries required — stdlib only.
"""

import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)

# JPEG markers
_SOI = b'\xff\xd8\xff'   # Start of Image
_EOI = b'\xff\xd9'       # End of Image

# Minimum plausible frame size in bytes.
# Filters out small embedded thumbnails / EXIF JPEGs in AVI metadata.
_MIN_FRAME_BYTES = 8_000


def extract_frames(avi_path: Path) -> List[bytes]:
    """
    Return a list of raw JPEG bytes, one per video frame, in order.

    Args:
        avi_path: Path to an MJPEG AVI file.

    Returns:
        List of bytes objects, each a valid JPEG.  Empty list on failure.
    """
    try:
        data = avi_path.read_bytes()
    except OSError as exc:
        logger.warning("Could not read AVI file %s: %s", avi_path, exc)
        return []

    frames: List[bytes] = []
    pos = 0

    while True:
        # Find next JPEG start
        soi = data.find(_SOI, pos)
        if soi == -1:
            break

        # Find matching EOI after the SOI
        eoi = data.find(_EOI, soi + len(_SOI))
        if eoi == -1:
            break

        jpeg = data[soi : eoi + len(_EOI)]
        if len(jpeg) >= _MIN_FRAME_BYTES:
            frames.append(jpeg)

        pos = eoi + len(_EOI)

    logger.info("Extracted %d frame(s) from %s", len(frames), avi_path.name)
    return frames


def save_frames(avi_path: Path, out_dir: Path) -> int:
    """
    Extract frames from an AVI and write them as frame_00.jpg, frame_01.jpg …

    Returns the number of frames written.
    """
    frames = extract_frames(avi_path)
    if not frames:
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    for i, jpeg in enumerate(frames):
        (out_dir / f"frame_{i:02d}.jpg").write_bytes(jpeg)

    return len(frames)
