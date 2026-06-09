"""
watcher.py — FinishPics local agent (TCP server).

Listens on port 16002 for FinishLynx scoreboard notifications sent by
RCP_FinishPics_Notify.lss.  FinishLynx keeps one persistent TCP connection
open (scoreboard "Network connect" mode); when OFFICIAL results are posted the
LSS script writes:

    \x13Event=<n>;Round=<c>;Heat=<n>;\r\n

On each notification:
  1. Parse event/round/heat from the message.
  2. Read the corresponding LIF file for athlete data.
  3. For each athlete, ask FinishLynx RC to export a per-athlete image crop.
  4. Upload each athlete's image to the FinishPics web API.

Usage:
    python watcher.py

Press Ctrl+C to stop.
"""

import configparser
import logging
import socket
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from avi_frames import extract_frames
from finishlynx import export_athlete_image, export_athlete_video
from lif_parser import parse_lif
from uploader import upload_athlete
from app_state import ActivityEntry, AppState

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
# Constants
# ---------------------------------------------------------------------------

HEAT_COOLDOWN  = 30.0   # don't re-process the same heat within N seconds
JPEG_WAIT_SECS = 15.0   # max time to wait for RC-exported JPEG to appear
JPEG_POLL_SECS = 0.25   # polling interval while waiting for JPEG
AVI_WAIT_SECS  = 30.0   # video encoding takes longer than JPEG

ROUND_NAMES = {
    'F': 'Final',
    'S': 'Semifinal',
    'P': 'Preliminary',
    'Q': 'Quarterfinal',
}

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config(config_path: Path) -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    if not config_path.exists():
        logger.error("Config file not found: %s", config_path)
        sys.exit(1)
    cfg.read(config_path, encoding='utf-8')
    return cfg

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_name(s: str) -> str:
    """Sanitise a name string for use in a filename."""
    result = ''.join(c if c.isalnum() else '-' for c in s)
    result = result.strip('-')
    # Collapse repeated hyphens
    while '--' in result:
        result = result.replace('--', '-')
    return result or 'unknown'


def wait_for_jpeg(path: Path, timeout: float = JPEG_WAIT_SECS) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if path.exists() and path.stat().st_size > 0:
            return True
        time.sleep(JPEG_POLL_SECS)
    return False


def parse_notification(raw: str) -> Optional[Tuple[str, str, str]]:
    """
    Parse 'Event=4;Round=F;Heat=3;' (leading \\x13 already stripped).
    Returns (event_num, round_code, heat_num) or None if malformed.
    """
    fields: dict[str, str] = {}
    for part in raw.split(';'):
        part = part.strip()
        if '=' in part:
            k, _, v = part.partition('=')
            fields[k.strip()] = v.strip()
    try:
        return (
            str(int(fields['Event'])),
            fields['Round'].upper(),
            str(int(fields['Heat'])),
        )
    except (KeyError, ValueError):
        return None

# ---------------------------------------------------------------------------
# Heat processor
# ---------------------------------------------------------------------------

class HeatProcessor:
    def __init__(self, cfg: configparser.ConfigParser,
                 state: Optional[AppState] = None) -> None:
        self.meet_name     = cfg.get('meet', 'name')
        self.meet_date     = cfg.get('meet', 'date')
        self.meet_location = cfg.get('meet', 'location', fallback='')
        self.company_name  = cfg.get('meet', 'company_name', fallback='')
        self.lif_dir          = cfg.get('finishlynx', 'lif_dir')
        self.rc_host          = cfg.get('finishlynx', 'rc_host')
        self.rc_port          = cfg.getint('finishlynx', 'rc_port')
        self.identilynx_window  = cfg.getint('finishlynx', 'identilynx_window', fallback=2)
        self.identilynx_enabled = cfg.getboolean('finishlynx', 'use_identilynx', fallback=True)
        self.api_url   = cfg.get('api', 'url')
        self.api_key   = cfg.get('api', 'key')
        self.state     = state

        self._lock: threading.Lock = threading.Lock()
        self._processed: dict[str, float] = {}  # stem → last processed ts

    def submit(self, event_num: str, round_code: str, heat_num: str) -> None:
        """Called from the socket thread; spawns a worker thread per heat."""
        stem = f"{event_num}-{round_code}-{heat_num}"
        with self._lock:
            last = self._processed.get(stem, 0.0)
            if time.time() - last < HEAT_COOLDOWN:
                logger.debug("Cooldown active for %s — skipping", stem)
                return
            self._processed[stem] = time.time()

        t = threading.Thread(target=self._process, args=(event_num, round_code, heat_num), daemon=True)
        t.start()

    def _process(self, event_num: str, round_code: str, heat_num: str) -> None:
        round_label = ROUND_NAMES.get(round_code, round_code)
        logger.info("Processing: Event %s  %s  Heat %s", event_num, round_label, heat_num)

        athletes, event_name, start_time = parse_lif(
            self.lif_dir, event_num, round_code, heat_num
        )

        if not athletes:
            logger.warning("No athletes found in LIF — nothing to export")
            return

        if not start_time:
            logger.warning("No start_time in LIF header — cannot compute athlete image times")
            return

        logger.info("Found %d athlete(s)  event='%s'  start=%s", len(athletes), event_name, start_time)

        ok_count = fail_count = 0

        # ---------------------------------------------------------------
        # Phase 1 — Fire ALL RC export commands immediately so FinishLynx
        # can start rendering every image/video in parallel.  No waiting
        # between athletes here.
        # ---------------------------------------------------------------
        pending = []   # athletes whose RC commands succeeded

        for athlete in athletes:
            if athlete['finish_time'] is None:
                logger.info("  Bib %s: no finish time — skipping", athlete['bib'])
                continue

            bib = athlete['bib']
            safe_last  = _safe_name(athlete['last_name'])
            safe_first = _safe_name(athlete['first_name'])
            has_bib    = bib and bib != '0'
            name_part  = f"{safe_last}-{safe_first}"
            jpeg_stem  = (
                f"{event_num}-{round_code}-{heat_num}-{name_part}-{bib}"
                if has_bib else
                f"{event_num}-{round_code}-{heat_num}-{name_part}"
            )
            jpeg_path = Path(self.lif_dir) / f"{jpeg_stem}.jpg"

            if jpeg_path.exists():
                jpeg_path.unlink(missing_ok=True)

            exported = export_athlete_image(
                host=self.rc_host,
                port=self.rc_port,
                filename_stem=jpeg_stem,
                start_time_str=start_time,
                race_seconds=athlete['finish_time'],
            )

            if not exported:
                logger.error("  Bib %s %s %s: RC image export failed — skipping",
                             bib, athlete['first_name'], athlete['last_name'])
                fail_count += 1
                continue

            # Fire IdentiLynx video export immediately too — don't wait for the
            # JPEG first, just queue both exports with FinishLynx now.
            avi_candidate: Optional[Path] = None
            if self.identilynx_enabled:
                video_exported = export_athlete_video(
                    host=self.rc_host,
                    port=self.rc_port,
                    filename_stem=jpeg_stem,
                    race_seconds=athlete['finish_time'],
                    window=self.identilynx_window,
                )
                if video_exported:
                    avi_candidate = Path(self.lif_dir) / f"{jpeg_stem}.avi"

            pending.append({
                'athlete':       athlete,
                'bib':           bib,
                'jpeg_path':     jpeg_path,
                'avi_candidate': avi_candidate,
            })

        logger.info("RC commands sent for %d athlete(s) — now waiting for exports",
                    len(pending))

        # ---------------------------------------------------------------
        # Phase 2 — Wait for each file to appear, then upload.  By the
        # time we reach the first athlete here, FinishLynx has already had
        # a head-start on rendering all images simultaneously.
        # ---------------------------------------------------------------
        for item in pending:
            athlete       = item['athlete']
            bib           = item['bib']
            jpeg_path     = item['jpeg_path']
            avi_candidate = item['avi_candidate']

            if not wait_for_jpeg(jpeg_path):
                logger.error("  Bib %s: JPEG did not appear within %.0fs", bib, JPEG_WAIT_SECS)
                fail_count += 1
                continue

            identilynx_frames: List[bytes] = []
            if avi_candidate is not None:
                if wait_for_jpeg(avi_candidate, timeout=AVI_WAIT_SECS):
                    identilynx_frames = extract_frames(avi_candidate)
                    if not identilynx_frames:
                        logger.warning("  Bib %s: AVI found but no frames extracted", bib)
                else:
                    logger.warning("  Bib %s: AVI did not appear within %.0fs — skipping frames",
                                   bib, AVI_WAIT_SECS)

            metadata = {
                'meet_name':     self.meet_name,
                'meet_date':     self.meet_date,
                'meet_location': self.meet_location,
                'company_name':  self.company_name,
                'event_num':  event_num,
                'round':      round_code,
                'heat':       heat_num,
                'event_name': event_name,
                'athlete': {
                    'bib':         bib,
                    'first_name':  athlete['first_name'],
                    'last_name':   athlete['last_name'],
                    'team':        athlete['team'],
                    'place':       athlete['place'],
                    'finish_time': athlete['finish_time'],
                },
            }

            success = upload_athlete(
                self.api_url, self.api_key, metadata,
                str(jpeg_path),
                identilynx_frames=identilynx_frames,
            )

            if success:
                logger.info("  OK  Bib %s  Place %s  %s %s  %s",
                            bib, athlete['place'],
                            athlete['first_name'], athlete['last_name'],
                            f"{athlete['finish_time']:.2f}s" if athlete['finish_time'] else '')
                ok_count += 1
            else:
                logger.error("  FAIL  Bib %s  %s %s", bib, athlete['first_name'], athlete['last_name'])
                fail_count += 1

            if self.state:
                ev_label = (
                    f"{event_name}  ·  Heat {heat_num}"
                    if event_name else
                    f"Event {event_num}  ·  Heat {heat_num}"
                )
                self.state.add_activity(ActivityEntry(
                    timestamp=datetime.now(),
                    first_name=athlete['first_name'],
                    last_name=athlete['last_name'],
                    event_label=ev_label,
                    finish_time=athlete['finish_time'],
                    success=success,
                    frame_count=len(identilynx_frames),
                ))

        logger.info("Event %s %s Heat %s complete: %d uploaded, %d failed",
                    event_num, round_label, heat_num, ok_count, fail_count)

# ---------------------------------------------------------------------------
# TCP server
# ---------------------------------------------------------------------------

def handle_client(conn: socket.socket, addr: tuple, processor: HeatProcessor) -> None:
    """
    Handles one FinishLynx scoreboard connection.  FinishLynx keeps the TCP
    connection open and sends a message per heat; we must not close the socket.
    Messages arrive as lines terminated by \\r\\n.  Each line may start with
    \\x13 (XOFF) which we strip before parsing.
    """
    logger.info("FinishLynx connected from %s:%d", addr[0], addr[1])
    if processor.state:
        processor.state.set_fl_connected(True)
    buf = b''
    try:
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                logger.info("FinishLynx disconnected from %s:%d", addr[0], addr[1])
                break
            buf += chunk
            while b'\r\n' in buf:
                line_bytes, buf = buf.split(b'\r\n', 1)
                line = line_bytes.decode('ascii', errors='replace').strip('\x13').strip()
                if not line:
                    continue
                logger.debug("Received: %r", line)
                parsed = parse_notification(line)
                if parsed:
                    processor.submit(*parsed)
                else:
                    logger.warning("Unrecognised message: %r", line)
    except (ConnectionResetError, OSError) as e:
        logger.info("Connection from %s:%d closed (%s)", addr[0], addr[1], e)
    finally:
        if processor.state:
            processor.state.set_fl_connected(False)
        conn.close()


def run_server(host: str, port: int, processor: HeatProcessor,
               stop_event: Optional[threading.Event] = None) -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((host, port))
    server.listen(5)
    server.settimeout(1.0)
    logger.info("Listening for FinishLynx on %s:%d", host, port)

    while not (stop_event and stop_event.is_set()):
        try:
            conn, addr = server.accept()
        except socket.timeout:
            continue
        t = threading.Thread(target=handle_client, args=(conn, addr, processor), daemon=True)
        t.start()

    server.close()
    logger.info("Server stopped.")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    config_path = Path(__file__).parent / 'config.ini'
    cfg = load_config(config_path)

    listen_host = cfg.get('finishlynx', 'listen_host', fallback='0.0.0.0')
    listen_port = cfg.getint('finishlynx', 'listen_port', fallback=16002)
    lif_dir     = cfg.get('finishlynx', 'lif_dir')
    rc_host     = cfg.get('finishlynx', 'rc_host')
    rc_port     = cfg.getint('finishlynx', 'rc_port')
    meet_name     = cfg.get('meet', 'name')
    meet_date     = cfg.get('meet', 'date')
    meet_location = cfg.get('meet', 'location', fallback='')
    company_name  = cfg.get('meet', 'company_name', fallback='')
    api_url     = cfg.get('api', 'url')

    identilynx_window = cfg.getint('finishlynx', 'identilynx_window', fallback=2)

    banner = (
        '\n'
        '==========================================================\n'
        '         FinishPics -- Photo Finish Agent\n'
        '==========================================================\n'
        f'  Company:       {company_name or "(not set)"}\n'
        f'  Meet:          {meet_name}\n'
        f'  Date:          {meet_date}\n'
        f'  Location:      {meet_location or "(not set)"}\n'
        f'  LIF directory: {lif_dir}\n'
        f'  FinishLynx RC: {rc_host}:{rc_port}\n'
        f'  IdentiLynx:    window {identilynx_window}\n'
        f'  Listening on:  {listen_host}:{listen_port}\n'
        f'  API endpoint:  {api_url}/api/upload\n'
        '\n'
        '  Waiting for FinishLynx official-results notifications...  (Ctrl+C to stop)\n'
        '----------------------------------------------------------'
    )
    print(banner)

    processor = HeatProcessor(cfg)

    try:
        run_server(listen_host, listen_port, processor)
    except KeyboardInterrupt:
        logger.info("Ctrl+C received — stopping.")


if __name__ == '__main__':
    main()
