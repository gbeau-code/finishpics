"""
uploader.py — Upload a per-athlete image and metadata to the FinishPics API.

Endpoint: POST {api_url}/api/upload
Headers:  X-API-Key: {api_key}
Body:     multipart/form-data
  - metadata: JSON string  (single athlete + event context)
  - image:    JPEG file bytes
"""

import json
import logging
from pathlib import Path
from typing import List, Optional

import requests

logger = logging.getLogger(__name__)

_UPLOAD_TIMEOUT = 30  # seconds


def upload_athlete(
    api_url: str,
    api_key: str,
    metadata: dict,
    image_path: str,
    identilynx_frames: Optional[List[bytes]] = None,
) -> bool:
    """
    Upload a single athlete's image (and optional video clip) to the FinishPics API.

    Args:
        api_url:    Base URL, e.g. "http://localhost:3000".
        api_key:    Value for the X-API-Key header.
        metadata:   Dict containing meet/event context and a single 'athlete' dict.
        image_path: Path to the athlete's JPEG file.
        identilynx_frames: Optional list of raw JPEG bytes (one per frame).

    Returns:
        True if the server returned 2xx, False otherwise.
    """
    path = Path(image_path)
    endpoint = f"{api_url.rstrip('/')}/api/upload"

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

    files: dict = {
        'metadata': (None, json.dumps(metadata), 'application/json'),
        'image':    (path.name, image_bytes, 'image/jpeg'),
    }

    if identilynx_frames:
        for i, frame_bytes in enumerate(identilynx_frames):
            files[f'frame_{i}'] = (f'frame_{i:02d}.jpg', frame_bytes, 'image/jpeg')

    try:
        response = requests.post(
            endpoint,
            headers={'X-API-Key': api_key},
            files=files,
            timeout=_UPLOAD_TIMEOUT,
        )
    except requests.exceptions.ConnectionError as exc:
        logger.error("Upload connection error: %s", exc)
        return False
    except requests.exceptions.Timeout:
        logger.error("Upload timed out after %ds", _UPLOAD_TIMEOUT)
        return False
    except requests.exceptions.RequestException as exc:
        logger.error("Upload failed: %s", exc)
        return False

    if response.ok:
        logger.debug("Upload HTTP %d: %s", response.status_code, _safe_text(response))
        return True
    else:
        logger.error("Upload HTTP %d: %s", response.status_code, _safe_text(response))
        return False


def _safe_text(response: requests.Response) -> str:
    try:
        text = response.text
        return text[:500] + '...' if len(text) > 500 else text
    except Exception:
        return '<unreadable>'
