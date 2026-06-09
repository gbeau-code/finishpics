"""
uploader.py — Upload a per-athlete image and metadata to the FinishPics API.

Two-step upload to stay under Vercel's 4.5 MB serverless payload limit:

  Step 1 — POST {api_url}/api/upload
      Sends: metadata (JSON) + photo-finish JPEG
      Returns: { athlete_id, heat_id }

  Step 2 — POST {api_url}/api/upload/frames  (only if IdentiLynx frames exist)
      Sends: athlete_id + frame_0 … frame_N (individual JPEGs)
      Returns: { frame_count }

The large photo-finish image and the frames are never sent together,
so each request comfortably stays below the 4.5 MB limit.
"""

import json
import logging
from pathlib import Path
from typing import List, Optional

import requests

logger = logging.getLogger(__name__)

_UPLOAD_TIMEOUT       = 30  # seconds — main image upload
_FRAME_UPLOAD_TIMEOUT = 60  # seconds — frame batch (encoding overhead)
_FRAME_BATCH_SIZE     = 3   # frames per upload request (~1.2 MB at 400 KB/frame)


def upload_athlete(
    api_url: str,
    api_key: str,
    metadata: dict,
    image_path: str,
    identilynx_frames: Optional[List[bytes]] = None,
) -> bool:
    """
    Upload a single athlete's image + optional IdentiLynx frames.

    Args:
        api_url:           Base URL, e.g. "https://www.finishpics.com".
        api_key:           Value for the X-API-Key header.
        metadata:          Dict containing meet/event context and a single
                           'athlete' dict.
        image_path:        Path to the athlete's JPEG file.
        identilynx_frames: Optional list of raw JPEG bytes (one per frame).

    Returns:
        True if all uploads succeeded, False if any failed.
    """
    path = Path(image_path)
    athlete = metadata.get('athlete', {})

    logger.info(
        "Uploading: Event=%s Round=%s Heat=%s  Bib=%s  %s %s  image=%s%s",
        metadata.get('event_num'), metadata.get('round'), metadata.get('heat'),
        athlete.get('bib'), athlete.get('first_name'), athlete.get('last_name'),
        path.name,
        f"  +{len(identilynx_frames)} IdentiLynx frames" if identilynx_frames else '',
    )

    if not path.exists():
        logger.error("Image file not found: %s — upload aborted", path)
        return False

    try:
        image_bytes = path.read_bytes()
    except OSError as exc:
        logger.error("Could not read image file %s: %s — upload aborted", path, exc)
        return False

    # ------------------------------------------------------------------
    # Step 1: upload photo-finish image + metadata (no frames)
    # ------------------------------------------------------------------
    athlete_id = _upload_image(api_url, api_key, metadata, path.name, image_bytes)
    if athlete_id is None:
        return False

    # ------------------------------------------------------------------
    # Step 2: upload IdentiLynx frames separately (if any)
    # ------------------------------------------------------------------
    if identilynx_frames:
        frames_ok = _upload_frames(api_url, api_key, athlete_id, identilynx_frames)
        if not frames_ok:
            # Main image is already saved; log the failure but report success=False
            # so the activity log shows it needs attention.
            return False

    return True


def _upload_image(
    api_url: str,
    api_key: str,
    metadata: dict,
    filename: str,
    image_bytes: bytes,
) -> Optional[str]:
    """
    POST image + metadata to /api/upload.
    Returns athlete_id on success, None on failure.
    """
    endpoint = f"{api_url.rstrip('/')}/api/upload"
    files = {
        'metadata': (None, json.dumps(metadata), 'application/json'),
        'image':    (filename, image_bytes, 'image/jpeg'),
    }
    try:
        response = requests.post(
            endpoint,
            headers={'X-API-Key': api_key},
            files=files,
            timeout=_UPLOAD_TIMEOUT,
        )
    except requests.exceptions.ConnectionError as exc:
        logger.error("Upload connection error: %s", exc)
        return None
    except requests.exceptions.Timeout:
        logger.error("Upload timed out after %ds", _UPLOAD_TIMEOUT)
        return None
    except requests.exceptions.RequestException as exc:
        logger.error("Upload failed: %s", exc)
        return None

    if response.ok:
        try:
            return response.json().get('athlete_id')
        except Exception:
            return None
    else:
        logger.error("Upload HTTP %d: %s", response.status_code, _safe_text(response))
        return None


def _upload_frames(
    api_url: str,
    api_key: str,
    athlete_id: str,
    frames: List[bytes],
) -> bool:
    """
    POST IdentiLynx frames to /api/upload/frames in batches of _FRAME_BATCH_SIZE.

    Batching is required because each frame can be ~400 KB; sending all at once
    can exceed Vercel's 4.5 MB serverless payload limit.

    Each batch includes the global frame indices so the server stores them at
    the correct position, and the total_frames count so the DB is updated once
    all batches are received.

    Returns True if every batch succeeded, False on first failure.
    """
    endpoint    = f"{api_url.rstrip('/')}/api/upload/frames"
    total       = len(frames)
    n_batches   = (total + _FRAME_BATCH_SIZE - 1) // _FRAME_BATCH_SIZE

    logger.info(
        "Uploading %d IdentiLynx frames for athlete %s (%d batch%s)",
        total, athlete_id, n_batches, '' if n_batches == 1 else 'es',
    )

    for batch_num, batch_start in enumerate(range(0, total, _FRAME_BATCH_SIZE), start=1):
        batch = frames[batch_start:batch_start + _FRAME_BATCH_SIZE]

        files: dict = {
            'athlete_id':   (None, athlete_id,   'text/plain'),
            'total_frames': (None, str(total),    'text/plain'),
        }
        for i, frame_bytes in enumerate(batch):
            global_idx = batch_start + i
            files[f'frame_{global_idx}'] = (
                f'frame_{global_idx:02d}.jpg', frame_bytes, 'image/jpeg'
            )

        logger.debug(
            "  Frame batch %d/%d: indices %d–%d",
            batch_num, n_batches, batch_start, batch_start + len(batch) - 1,
        )

        try:
            response = requests.post(
                endpoint,
                headers={'X-API-Key': api_key},
                files=files,
                timeout=_FRAME_UPLOAD_TIMEOUT,
            )
        except requests.exceptions.ConnectionError as exc:
            logger.error("Frame upload connection error: %s", exc)
            return False
        except requests.exceptions.Timeout:
            logger.error("Frame upload timed out after %ds", _FRAME_UPLOAD_TIMEOUT)
            return False
        except requests.exceptions.RequestException as exc:
            logger.error("Frame upload failed: %s", exc)
            return False

        if not response.ok:
            logger.error(
                "Frame upload HTTP %d (batch %d/%d): %s",
                response.status_code, batch_num, n_batches, _safe_text(response),
            )
            return False

    logger.info("All %d frame(s) uploaded successfully", total)
    return True


def _safe_text(response: requests.Response) -> str:
    try:
        text = response.text
        return text[:500] + '...' if len(text) > 500 else text
    except Exception:
        return '<unreadable>'
