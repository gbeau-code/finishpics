"""
lif_parser.py — Parse FinishLynx per-heat LIF files.

Real LIF format (one file per heat, e.g. C:\Meets\001-1-01.lif):

  Header row:
    event_num, round_num, heat_num, event_name, wind, wind_unit, ..., distance, start_time
    e.g.: 1,1,1,Women 100 Meter Dash,-0.2,M/S E,,,,100,16:40:11.4697

  Result rows:
    place, bib, lane, last_name, first_name, team, finish_time, ...
    e.g.: 1,797,4,Berson,Norah,New England,12.39,...
    e.g.: DNF,808,7,Miller,Isabella,New England,...
"""

import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _fix_name(s: str) -> str:
    """
    Title-case a name only when it is entirely lower- or upper-case,
    which indicates a data-entry error rather than intentional capitalisation.
    Mixed-case names (e.g. 'McDonald', 'de la Cruz') are left untouched.
    """
    stripped = s.strip()
    if not stripped:
        return stripped
    if stripped == stripped.lower() or stripped == stripped.upper():
        return stripped.title()
    return stripped


def _parse_time(s: str) -> Optional[float]:
    """Convert '12.39', '2:17.17' etc to float seconds. Returns None if unparseable."""
    s = s.strip()
    s = re.sub(r'[a-zA-Z]+$', '', s).strip()  # strip trailing letters (h, a, w)
    if not s:
        return None
    try:
        if ':' in s:
            parts = s.split(':', 1)
            return float(parts[0]) * 60.0 + float(parts[1])
        return float(s)
    except ValueError:
        return None


def _find_lif_file(lif_dir: str, event_num: str, round_code: str, heat_num: str) -> Optional[Path]:
    """
    Locate the LIF file for a given heat. FinishLynx zero-pads event (3 digits)
    and heat (2 digits) in filenames: 001-1-01.lif
    """
    base = Path(lif_dir)
    if not base.exists():
        return None

    candidates = [
        # Zero-padded (most common): 001-1-01.lif
        base / f"{int(event_num):03d}-{round_code}-{int(heat_num):02d}.lif",
        # Unpadded fallback: 1-1-1.lif
        base / f"{event_num}-{round_code}-{heat_num}.lif",
    ]

    for path in candidates:
        if path.exists():
            logger.debug("Found LIF file: %s", path)
            return path

    return None


def parse_lif(lif_dir: str, event_num: str, round_code: str, heat_num: str) -> tuple[list[dict], str, Optional[str]]:
    """
    Parse a FinishLynx per-heat LIF file and return athletes for that heat.

    Args:
        lif_dir:    Directory where LIF files live (e.g. C:\\Meets).
        event_num:  Event number as string, e.g. "1".
        round_code: Round code as string, e.g. "1" (numeric) or "F" (alpha).
        heat_num:   Heat number as string, e.g. "1".

    Returns:
        (athletes, event_name, start_time) where:
          athletes:   list of dicts with place, bib, first_name, last_name, team, finish_time
          event_name: string from header row, e.g. "Women 100 Meter Dash"
          start_time: TOD string from header, e.g. "16:40:11.4697", or None
        Returns ([], "", None) with a warning if the file is missing or unreadable.
    """
    logger.info(
        "Looking for LIF in %s  Event=%s Round=%s Heat=%s",
        lif_dir, event_num, round_code, heat_num,
    )

    lif_path = _find_lif_file(lif_dir, event_num, round_code, heat_num)
    if lif_path is None:
        logger.warning(
            "LIF file not found for Event=%s Round=%s Heat=%s in %s",
            event_num, round_code, heat_num, lif_dir,
        )
        return [], '', None

    logger.info("Parsing LIF: %s", lif_path)

    try:
        try:
            text = lif_path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            text = lif_path.read_text(encoding='latin-1')
    except OSError as exc:
        logger.warning("Could not read LIF file %s: %s", lif_path, exc)
        return [], '', None

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        logger.warning("LIF file is empty: %s", lif_path)
        return [], '', None

    athletes = []
    event_name = ''
    start_time: Optional[str] = None

    for i, line in enumerate(lines):
        # Split on comma, preserving quoted fields
        parts = _split_lif_line(line)

        if i == 0:
            # Header row: event_num,round,heat,event_name,...,distance,start_time
            event_name = parts[3].strip() if len(parts) > 3 else ''
            start_time = parts[-1].strip() if parts else None
            logger.info("  Event: %s  StartTime: %s", event_name, start_time)
            continue

        if len(parts) < 6:
            continue

        place_raw = parts[0].strip()

        # Skip DNS, DNF, DQ and other non-numeric place values
        if not place_raw.isdigit():
            logger.info("  Skipping %s: %s %s", place_raw,
                        parts[4].strip() if len(parts) > 4 else '',
                        parts[3].strip() if len(parts) > 3 else '')
            continue

        place = int(place_raw)
        bib = parts[1].strip()
        last_name  = _fix_name(parts[3])
        first_name = _fix_name(parts[4])
        team = parts[5].strip()
        finish_time = _parse_time(parts[6]) if len(parts) > 6 else None

        athlete = {
            'place': place,
            'bib': bib,
            'first_name': first_name,
            'last_name': last_name,
            'team': team,
            'finish_time': finish_time,
        }
        athletes.append(athlete)
        logger.info(
            "  Place=%d Bib=%s  %s %s  %s  %s",
            place, bib, first_name, last_name, team,
            f"{finish_time:.2f}s" if finish_time else 'no time',
        )

    logger.info("LIF parsed: %d athlete(s) found  start_time=%s", len(athletes), start_time)
    return athletes, event_name, start_time


def _split_lif_line(line: str) -> list[str]:
    """
    Split a LIF line on commas, handling quoted fields like "1,5".
    Returns list of raw field strings (not stripped).
    """
    fields = []
    current = []
    in_quotes = False

    for ch in line:
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == ',' and not in_quotes:
            fields.append(''.join(current))
            current = []
        else:
            current.append(ch)

    fields.append(''.join(current))
    return fields
