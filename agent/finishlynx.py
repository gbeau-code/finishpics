"""
finishlynx.py — FinishLynx Remote Control TCP interface.

Protocol overview:
  - Connect to host:port (TCP)
  - Send command terminated by \r\n
  - FinishLynx echoes back the sent command before the actual reply
  - Read lines until one starts with "Reply="
  - Close connection

Time format:
  FinishLynx uses time-of-day (TOD) in the image coordinate system.
  Format: H:MM:SS.ffff for times >= 1 hour, M:SS.ffff for times < 1 hour.
  LIF start_time (e.g. "16:40:11.4697") + race seconds = athlete TOD.
"""

import logging
import re
import socket
import time
from typing import Optional

logger = logging.getLogger(__name__)

_RC_TIMEOUT = 5.0       # seconds for connect + read
_MAX_RECV_BYTES = 4096
_CROP_PX = 600          # pixels either side of athlete's finish time


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_rc_time(time_str: str) -> Optional[float]:
    """
    Convert a Remote Control time string to float seconds.
    Handles both H:MM:SS.ffff and M:SS.ffff formats.
    """
    s = time_str.strip()
    try:
        parts = s.split(':')
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        else:
            return float(s)
    except ValueError:
        logger.debug("Could not parse RC time string: %r", s)
        return None


def _format_athlete_tod(start_time_str: str, race_seconds: float) -> str:
    """
    Compute athlete's image TOD from LIF start_time + race elapsed seconds.

    start_time_str: '16:40:11.4697'  (H:MM:SS.ffff from LIF header)
    race_seconds:   12.39            (float seconds from gun)
    Returns:        '16:40:23.8597'  (RC Time= format)
    """
    parts = start_time_str.split(':')
    start_total = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    athlete_total = start_total + race_seconds

    h = int(athlete_total // 3600)
    rem = athlete_total - h * 3600
    m = int(rem // 60)
    s = rem - m * 60

    return f"{h}:{m:02d}:{s:07.4f}"


def _send_rc_command(host: str, port: int, command: str) -> Optional[str]:
    """
    Send a single RC command and return the Reply= line, or None on failure.
    command should NOT include the trailing \\r\\n.
    """
    raw = (command + '\r\n').encode('ascii')
    try:
        sock = socket.create_connection((host, port), timeout=_RC_TIMEOUT)
    except (OSError, ConnectionRefusedError, TimeoutError) as exc:
        logger.warning("RC connection failed (%s:%d): %s", host, port, exc)
        return None

    reply_line = None
    try:
        sock.settimeout(_RC_TIMEOUT)
        sock.sendall(raw)
        logger.debug("RC sent: %r", raw)

        buf = b''
        while True:
            try:
                chunk = sock.recv(_MAX_RECV_BYTES)
            except (TimeoutError, socket.timeout):
                logger.warning("RC recv timed out waiting for Reply=")
                break
            if not chunk:
                break
            buf += chunk
            while b'\n' in buf:
                idx = buf.index(b'\n')
                line = buf[:idx].rstrip(b'\r').decode('ascii', errors='replace').strip()
                buf = buf[idx + 1:]
                logger.debug("RC recv: %r", line)
                if line.startswith('Reply='):
                    reply_line = line
                    break
            if reply_line is not None:
                break
    except OSError as exc:
        logger.warning("RC socket error: %s", exc)
    finally:
        try:
            sock.close()
        except OSError:
            pass

    return reply_line


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_image_info(host: str, port: int) -> tuple[Optional[float], Optional[float]]:
    """
    Query FinishLynx RC for current image time bounds.
    Returns (first_frame_time, last_frame_time) in seconds, or (None, None).
    """
    logger.info("Querying FinishLynx RC at %s:%d for image info...", host, port)
    reply = _send_rc_command(host, port, 'Command=ImageGetInfo;Options=768;')
    if not reply or 'Reply=Ok' not in reply:
        logger.warning("RC ImageGetInfo failed: %r", reply)
        return None, None

    first_match = re.search(r'FirstTime=([^;]+)', reply)
    last_match  = re.search(r'LastTime=([^;]+)',  reply)
    if not first_match or not last_match:
        logger.warning("RC reply missing FirstTime/LastTime: %r", reply)
        return None, None

    first = _parse_rc_time(first_match.group(1))
    last  = _parse_rc_time(last_match.group(1))
    if first is not None and last is not None:
        logger.info("RC image bounds: first=%.4fs  last=%.4fs", first, last)
    return first, last


def export_athlete_video(
    host: str,
    port: int,
    filename_stem: str,
    race_seconds: float,
    window: int = 2,
    frames: int = 5,
) -> bool:
    """
    Export an IdentiLynx video clip via FinishLynx RC.

    Exports 'frames' frames before and after the athlete's finish time.
    Output file: {filename_stem}.avi in the FinishLynx working directory.

    Args:
        window: IdentiLynx camera window number (default 2).
        frames: Number of frames either side of the finish time.
    """
    hash_time = f"{race_seconds:.4f}"
    logger.info(
        "RC ImageExportVideo: File=%s  HashTime=%s  Window=%d  ±%d frames",
        filename_stem, hash_time, window, frames,
    )

    reply = _send_rc_command(
        host, port,
        f'Command=ImageExportVideo;Window={window};File={filename_stem};Time={hash_time},-{frames},,{frames};',
    )
    if reply and 'Reply=Ok' in reply:
        logger.info("RC ImageExportVideo OK: %s.avi", filename_stem)
        return True

    logger.warning("RC ImageExportVideo failed for %s: %r", filename_stem, reply)
    return False


def export_athlete_image(
    host: str,
    port: int,
    filename_stem: str,
    start_time_str: str,
    race_seconds: float,
    window: int = 1,
) -> bool:
    """
    Export a per-athlete image crop via FinishLynx RC.

    Two-step per the RC spec:
      1. ImageDraw;HashTime=<secs>  — move the visible print line to the athlete's time.
      2. ImageExport;Time=<secs>;   — export crop centred on that time at full image height.

    Time= uses race-relative decimal seconds (e.g. 14.3300), NOT wall-clock TOD.
    ImageDraw must come first; ImageExport;Time=; (empty) locks the hash and
    prevents subsequent ImageDraw commands from taking effect.
    """
    # FinishLynx image coordinates are race-relative decimal seconds, not wall-clock TOD.
    # ImageGetInfo returns e.g. Time=16.3345 (seconds from gun), so HashTime= uses the same.
    hash_time = f"{race_seconds:.4f}"
    logger.info("RC ImageExport: File=%s  HashTime=%s", filename_stem, hash_time)

    # Step 1: move the visible print/hash line to the athlete's finish time.
    draw_reply = _send_rc_command(
        host, port,
        f'Command=ImageDraw;Window={window};HashTime={hash_time};',
    )
    if not draw_reply or 'Reply=Ok' not in draw_reply:
        logger.warning("RC ImageDraw failed for %s: %r", filename_stem, draw_reply)
        return False

    # Step 2: export the crop centered on the athlete's time at full image height.
    # 0a = absolute top, -1a = absolute bottom (last row), ±_CROP_PX r = relative to hash.
    export_reply = _send_rc_command(
        host, port,
        f'Command=ImageExport;File={filename_stem};Window={window};Time={hash_time};Area=-{_CROP_PX}r,0a,{_CROP_PX}r,-1a;',
    )
    if export_reply and 'Reply=Ok' in export_reply:
        logger.info("RC ImageExport OK: %s.jpg", filename_stem)
        return True

    logger.warning("RC ImageExport failed for %s: %r", filename_stem, export_reply)
    return False
