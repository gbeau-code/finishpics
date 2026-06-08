"""
app_state.py — Thread-safe shared state between the agent and the GUI.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class ActivityEntry:
    timestamp: datetime
    first_name: str
    last_name: str
    event_label: str        # e.g. "Men 1500m · Heat 2"
    finish_time: Optional[float]
    success: bool
    frame_count: int = 0


class AppState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fl_connected: bool = False
        self._running: bool = False
        self._activity: List[ActivityEntry] = []

    # ── Connection flags ─────────────────────────────────────────────────────

    def set_fl_connected(self, v: bool) -> None:
        with self._lock:
            self._fl_connected = v

    def set_running(self, v: bool) -> None:
        with self._lock:
            self._running = v

    def get_fl_connected(self) -> bool:
        with self._lock:
            return self._fl_connected

    def is_running(self) -> bool:
        with self._lock:
            return self._running

    # ── Activity log ─────────────────────────────────────────────────────────

    def add_activity(self, entry: ActivityEntry) -> None:
        with self._lock:
            self._activity.insert(0, entry)
            if len(self._activity) > 100:
                self._activity.pop()

    def get_activity(self) -> List[ActivityEntry]:
        with self._lock:
            return list(self._activity)
