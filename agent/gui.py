"""
gui.py — FinishPics Agent  ·  Operator GUI

Run with:  python gui.py

Requires:
    pip install customtkinter
    Place Roboto Mono TTF files in agent/fonts/
    (download from fonts.google.com/specimen/Roboto+Mono)
"""

from __future__ import annotations

import configparser
import ctypes
import socket
import sys
import threading
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import List, Optional

import customtkinter as ctk

from app_state import ActivityEntry, AppState
from watcher import HeatProcessor, load_config, run_server

# ── Palette ──────────────────────────────────────────────────────────────────
NAVY     = "#0B0D2E"
CARD     = "#10133A"
CARD2    = "#161A48"   # slightly lighter card for inputs
BORDER   = "#1E245C"
BLUE     = "#0C7FEA"
BLUE_HV  = "#0A66C2"
WHITE    = "#FFFFFF"
GREY     = "#8AAAC8"
DIM      = "#3D5070"
GREEN    = "#22C55E"
RED      = "#EF4444"

# ── Font ─────────────────────────────────────────────────────────────────────
_FONT_DIR = Path(__file__).parent / "fonts"
_MONO     = "Roboto Condensed"
_FALLBACK = "Courier New"


def _load_fonts() -> str:
    """
    Load every TTF in agent/fonts/ into the Windows GDI font table
    (private to this process).  Returns the family name to use.
    """
    if sys.platform != "win32":
        return _FALLBACK
    loaded = False
    try:
        FR_PRIVATE = 0x10
        for ttf in sorted(_FONT_DIR.glob("*.ttf")):
            res = ctypes.windll.gdi32.AddFontResourceExW(str(ttf), FR_PRIVATE, 0)
            if res:
                loaded = True
    except Exception:
        pass
    return _MONO if loaded else _FALLBACK


# In a PyInstaller bundle, __file__ resolves inside the _internal folder;
# config.ini lives next to the exe so users can edit it.
_APP_DIR = (
    Path(sys.executable).parent
    if getattr(sys, "frozen", False)
    else Path(__file__).parent
)
CONFIG_PATH = _APP_DIR / "config.ini"


def _write_config(cfg: configparser.ConfigParser) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
        cfg.write(fh)


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  Reusable widgets                                                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class _Dot(ctk.CTkFrame):
    """10 px coloured circle for connection status."""

    def __init__(self, master, **kw):
        super().__init__(master, width=10, height=10,
                         corner_radius=5, fg_color=DIM, **kw)
        self._state: Optional[bool] = None

    def set(self, ok: bool) -> None:
        if ok == self._state:
            return
        self._state = ok
        self.configure(fg_color=GREEN if ok else RED)


class StatusCard(ctk.CTkFrame):
    """Small card: coloured dot + label."""

    def __init__(self, master, label: str, font, **kw):
        super().__init__(master, fg_color=CARD, corner_radius=10,
                         border_width=1, border_color=BORDER, **kw)
        self.grid_columnconfigure(1, weight=1)
        self._dot = _Dot(self)
        self._dot.grid(row=0, column=0, padx=(14, 8), pady=14)
        ctk.CTkLabel(self, text=label, font=font,
                     text_color=GREY, anchor="w").grid(
            row=0, column=1, padx=(0, 14), pady=14, sticky="w")

    def set(self, ok: bool) -> None:
        self._dot.set(ok)


class _SectionLabel(ctk.CTkLabel):
    """Small all-caps section heading used in the settings/meet forms."""

    def __init__(self, master, text: str, font, **kw):
        super().__init__(master, text=text, font=font,
                         text_color=BLUE, anchor="w", **kw)


class _FieldLabel(ctk.CTkLabel):
    def __init__(self, master, text: str, font, **kw):
        super().__init__(master, text=text, font=font,
                         text_color=GREY, anchor="e", **kw)


class _Entry(ctk.CTkEntry):
    def __init__(self, master, font, var: ctk.StringVar,
                 password: bool = False, **kw):
        super().__init__(master, textvariable=var, font=font,
                         fg_color=CARD2, border_color=BORDER,
                         text_color=WHITE, corner_radius=8, height=36,
                         show="●" if password else "", **kw)


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  ActivityRow                                                             ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class ActivityRow(ctk.CTkFrame):
    """One row in the recent-activity log."""

    def __init__(self, master, entry: ActivityEntry,
                 f_body, f_xs, **kw):
        super().__init__(master, fg_color="transparent", **kw)
        self.grid_columnconfigure(1, weight=1)
        self.grid_columnconfigure(2, weight=1)

        ts     = entry.timestamp.strftime("%H:%M:%S")
        name   = f"{entry.last_name}, {entry.first_name}"
        ft     = (
            f"{entry.finish_time:.2f}"
            if entry.finish_time is not None else "—"
        )
        frames = f"  +{entry.frame_count}f" if entry.frame_count else ""
        ok_col = GREEN if entry.success else RED
        ok_chr = "✓" if entry.success else "✗"

        ctk.CTkLabel(self, text=ts, font=f_xs,
                     text_color=DIM, anchor="w", width=68).grid(
            row=0, column=0, padx=(0, 10), pady=(6, 0), sticky="w")

        ctk.CTkLabel(self, text=name, font=f_body,
                     text_color=WHITE, anchor="w").grid(
            row=0, column=1, padx=(0, 10), pady=(6, 0), sticky="w")

        ctk.CTkLabel(self, text=entry.event_label, font=f_xs,
                     text_color=GREY, anchor="w").grid(
            row=1, column=1, padx=(0, 10), pady=(0, 2), sticky="w")

        ctk.CTkLabel(self, text=ft + frames, font=f_body,
                     text_color=BLUE, anchor="e").grid(
            row=0, column=2, padx=(0, 10), pady=(6, 0), sticky="e")

        ctk.CTkLabel(self, text=ok_chr, font=f_body,
                     text_color=ok_col, anchor="e", width=20).grid(
            row=0, column=3, padx=(0, 4), pady=(6, 0), sticky="e")

        # hairline separator
        ctk.CTkFrame(self, height=1, fg_color=BORDER).grid(
            row=2, column=0, columnspan=4, sticky="ew", pady=(4, 0))


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  Main App Window                                                         ║
# ╚══════════════════════════════════════════════════════════════════════════╝

class App(ctk.CTk):

    def __init__(self, font_family: str) -> None:
        super().__init__()

        # Fonts
        self.f_title = ctk.CTkFont(family=font_family, size=16, weight="bold")
        self.f_head  = ctk.CTkFont(family=font_family, size=12, weight="bold")
        self.f_body  = ctk.CTkFont(family=font_family, size=12)
        self.f_sm    = ctk.CTkFont(family=font_family, size=11)
        self.f_xs    = ctk.CTkFont(family=font_family, size=10)
        self.f_lbl   = ctk.CTkFont(family=font_family, size=10, weight="bold")

        # State & config
        self.app_state     = AppState()
        self.cfg       = load_config(CONFIG_PATH)
        self._stop_ev  = threading.Event()
        self._agent_t: Optional[threading.Thread] = None
        self._processor: Optional[HeatProcessor] = None

        # Window
        self.title("FinishPics")
        self.geometry("860x600")
        self.minsize(740, 500)
        self.configure(fg_color=NAVY)

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._build_header()
        self._build_tabs()

        # Polling — track newest entry timestamp to detect changes past 100-entry cap
        self._prev_latest_ts = None
        self._poll()

    # ── Header ───────────────────────────────────────────────────────────────

    def _build_header(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color=CARD, corner_radius=0, height=58)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_propagate(False)
        hdr.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(hdr, text="FINISHPICS", font=self.f_title,
                     text_color=WHITE).grid(
            row=0, column=0, padx=(22, 0), pady=0, sticky="w")

        ctk.CTkLabel(hdr, text="by In Stride Timing", font=self.f_xs,
                     text_color=DIM).grid(
            row=0, column=1, padx=(10, 0), pady=(6, 0), sticky="sw")

        self._btn = ctk.CTkButton(
            hdr, text="▶  START", font=self.f_head,
            fg_color=BLUE, hover_color=BLUE_HV,
            text_color=WHITE, corner_radius=8,
            width=116, height=36,
            command=self._toggle,
        )
        self._btn.grid(row=0, column=2, padx=20, pady=11, sticky="e")

        # Blue accent line at bottom of header
        ctk.CTkFrame(hdr, height=3, fg_color=BLUE, corner_radius=0).place(
            relx=0, rely=1.0, relwidth=1.0, anchor="sw")

    # ── Tabs ─────────────────────────────────────────────────────────────────

    def _build_tabs(self) -> None:
        self._tabs = ctk.CTkTabview(
            self,
            fg_color=NAVY,
            segmented_button_fg_color=CARD,
            segmented_button_selected_color=BLUE,
            segmented_button_selected_hover_color=BLUE_HV,
            segmented_button_unselected_color=CARD,
            segmented_button_unselected_hover_color=BORDER,
            text_color=GREY,
            text_color_disabled=DIM,
        )
        self._tabs.grid(row=1, column=0, sticky="nsew")

        for name in ("  Status  ", "  Meet  ", "  Settings  "):
            self._tabs.add(name)

        self._build_status(self._tabs.tab("  Status  "))
        self._build_meet(self._tabs.tab("  Meet  "))
        self._build_settings(self._tabs.tab("  Settings  "))

    # ── Status tab ───────────────────────────────────────────────────────────

    def _build_status(self, parent: ctk.CTkFrame) -> None:
        parent.grid_rowconfigure(1, weight=1)
        parent.grid_columnconfigure((0, 1, 2), weight=1)

        # Three status cards
        self._c_fl  = StatusCard(parent, "FinishLynx", self.f_sm)
        self._c_lif = StatusCard(parent, "LIF Watch",  self.f_sm)
        self._c_api = StatusCard(parent, "API Server", self.f_sm)

        pads = [(18, 8), (8, 8), (8, 18)]
        for i, (card, (pl, pr)) in enumerate(
                zip([self._c_fl, self._c_lif, self._c_api], pads)):
            card.grid(row=0, column=i, padx=(pl, pr), pady=(14, 8), sticky="ew")

        # Activity log panel
        panel = ctk.CTkFrame(parent, fg_color=CARD, corner_radius=10,
                             border_width=1, border_color=BORDER)
        panel.grid(row=1, column=0, columnspan=3,
                   padx=18, pady=(8, 18), sticky="nsew")
        panel.grid_rowconfigure(1, weight=1)
        panel.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(panel, text="RECENT ACTIVITY", font=self.f_lbl,
                     text_color=DIM, anchor="w").grid(
            row=0, column=0, padx=16, pady=(12, 6), sticky="w")

        self._log_frame = ctk.CTkScrollableFrame(
            panel, fg_color="transparent",
            scrollbar_button_color=BORDER,
            scrollbar_button_hover_color=BLUE,
        )
        self._log_frame.grid(row=1, column=0, padx=8, pady=(0, 10), sticky="nsew")
        self._log_frame.grid_columnconfigure(0, weight=1)
        self._log_rows: List[ActivityRow] = []

        self._empty_label = ctk.CTkLabel(
            self._log_frame,
            text="No activity yet — waiting for FinishLynx results...",
            font=self.f_xs, text_color=DIM,
        )
        self._empty_label.pack(pady=20)

    # ── Meet tab ─────────────────────────────────────────────────────────────

    def _build_meet(self, parent: ctk.CTkFrame) -> None:
        parent.grid_columnconfigure(0, weight=0)
        parent.grid_columnconfigure(1, weight=1)

        _SectionLabel(parent, "MEET INFORMATION", self.f_lbl).grid(
            row=0, column=0, columnspan=2, padx=24, pady=(18, 10), sticky="w")

        fields = [
            ("Timing Company", "company_name", "meet", "In Stride Timing"),
            ("Meet Name",      "name",         "meet", "Spring Invitational 2026"),
            ("Date",           "date",         "meet", "2026-06-07"),
            ("Location",       "location",     "meet", "City, State"),
        ]
        self._mv: dict[str, ctk.StringVar] = {}
        for i, (label, key, section, placeholder) in enumerate(fields, start=1):
            _FieldLabel(parent, label, self.f_sm).grid(
                row=i, column=0, padx=(24, 12), pady=8, sticky="e")
            var = ctk.StringVar(value=self.cfg.get(section, key, fallback=""))
            _Entry(parent, self.f_body, var,
                   placeholder_text=placeholder).grid(
                row=i, column=1, padx=(0, 24), pady=8, sticky="ew")
            self._mv[key] = var

        ctk.CTkLabel(parent,
                     text="Changes apply immediately — no restart needed.",
                     font=self.f_xs, text_color=DIM).grid(
            row=5, column=1, padx=(0, 24), pady=(2, 12), sticky="w")

        ctk.CTkButton(parent, text="Save Meet Info", font=self.f_head,
                      fg_color=BLUE, hover_color=BLUE_HV,
                      corner_radius=8, height=36,
                      command=self._save_meet).grid(
            row=6, column=1, padx=(0, 24), pady=4, sticky="w")

    # ── Settings tab ─────────────────────────────────────────────────────────

    def _build_settings(self, parent: ctk.CTkFrame) -> None:
        parent.grid_columnconfigure(0, weight=0)
        parent.grid_columnconfigure(1, weight=1)
        parent.grid_columnconfigure(2, weight=0)

        self._sv: dict[str, ctk.StringVar] = {}
        row = [0]   # mutable counter

        def nxt() -> int:
            r = row[0]; row[0] += 1; return r

        def section(text: str) -> None:
            _SectionLabel(parent, text, self.f_lbl).grid(
                row=nxt(), column=0, columnspan=3,
                padx=24, pady=(18, 6), sticky="w")

        def field(label: str, key: str, sec: str,
                  fallback: str = "", password: bool = False,
                  wide: bool = True, choices: Optional[List[str]] = None) -> None:
            r = nxt()
            _FieldLabel(parent, label, self.f_sm).grid(
                row=r, column=0, padx=(24, 12), pady=6, sticky="e")

            var = ctk.StringVar(value=self.cfg.get(sec, key, fallback=fallback))
            self._sv[f"{sec}.{key}"] = var

            if choices:
                ctk.CTkOptionMenu(
                    parent, values=choices, variable=var,
                    font=self.f_body,
                    fg_color=CARD2, button_color=BLUE,
                    button_hover_color=BLUE_HV,
                    dropdown_fg_color=CARD, dropdown_text_color=WHITE,
                    dropdown_hover_color=BORDER,
                    text_color=WHITE, corner_radius=8, height=36,
                ).grid(row=r, column=1, padx=(0, 24), pady=6, sticky="w")
            else:
                span = 2 if wide else 1
                _Entry(parent, self.f_body, var, password=password).grid(
                    row=r, column=1, columnspan=span,
                    padx=(0, 24), pady=6, sticky="ew")

        # LIF directory gets a Browse button
        def lif_row() -> None:
            r = nxt()
            _FieldLabel(parent, "LIF Directory", self.f_sm).grid(
                row=r, column=0, padx=(24, 12), pady=6, sticky="e")
            var = ctk.StringVar(
                value=self.cfg.get("finishlynx", "lif_dir", fallback=""))
            self._sv["finishlynx.lif_dir"] = var
            _Entry(parent, self.f_body, var).grid(
                row=r, column=1, padx=(0, 8), pady=6, sticky="ew")
            ctk.CTkButton(parent, text="Browse", font=self.f_sm,
                          fg_color=BORDER, hover_color=BLUE,
                          corner_radius=8, width=76, height=36,
                          command=self._browse_lif).grid(
                row=r, column=2, padx=(0, 24), pady=6)

        # ─ FinishLynx ─
        section("FINISHLYNX")
        lif_row()
        field("RC Host",          "rc_host",          "finishlynx", "127.0.0.1", wide=False)
        field("RC Port",          "rc_port",          "finishlynx", "16000",     wide=False)
        field("Listen Port",      "listen_port",      "finishlynx", "16002",     wide=False)
        field("IdentiLynx Window","identilynx_window","finishlynx", "2",
              choices=["1","2","3","4"])

        # IdentiLynx enable/disable checkbox
        r_idl = nxt()
        _FieldLabel(parent, "IdentiLynx Frames", self.f_sm).grid(
            row=r_idl, column=0, padx=(24, 12), pady=6, sticky="e")
        self._idl_var = ctk.BooleanVar(
            value=self.cfg.getboolean("finishlynx", "use_identilynx", fallback=True))
        ctk.CTkCheckBox(
            parent,
            text="Enable IdentiLynx frame uploads",
            variable=self._idl_var,
            font=self.f_body,
            text_color=WHITE,
            fg_color=BLUE,
            hover_color=BLUE_HV,
            border_color=BORDER,
        ).grid(row=r_idl, column=1, padx=(0, 24), pady=6, sticky="w")

        # ─ API ─
        section("API")
        field("Server URL", "url", "api", "http://localhost:3000")
        field("API Key",    "key", "api", "", password=True)

        r_save = nxt()
        ctk.CTkButton(parent, text="Save Settings", font=self.f_head,
                      fg_color=BLUE, hover_color=BLUE_HV,
                      corner_radius=8, height=36,
                      command=self._save_settings).grid(
            row=r_save, column=1, padx=(0, 24), pady=(16, 8), sticky="w")

    # ── Agent control ─────────────────────────────────────────────────────────

    def _toggle(self) -> None:
        if self.app_state.is_running():
            self._stop()
        else:
            self._start()

    def _start(self) -> None:
        self.cfg = load_config(CONFIG_PATH)
        listen_host = self.cfg.get("finishlynx", "listen_host", fallback="0.0.0.0")
        listen_port = self.cfg.getint("finishlynx", "listen_port", fallback=16002)

        # Test the port before starting the thread so failures are visible
        try:
            test = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            test.bind((listen_host, listen_port))
            test.close()
        except OSError:
            messagebox.showerror(
                "Port In Use",
                f"Port {listen_port} is already in use.\n\n"
                "Another watcher.py or agent instance is running.\n"
                "Close it and try again.",
                parent=self,
            )
            return

        self._stop_ev.clear()
        self._processor = HeatProcessor(self.cfg, state=self.app_state)
        self.app_state.set_running(True)

        self._agent_t = threading.Thread(
            target=run_server,
            args=(listen_host, listen_port, self._processor, self._stop_ev),
            daemon=True,
        )
        self._agent_t.start()
        self._btn.configure(text="■  STOP", fg_color=RED,
                            hover_color="#C53030")

    def _stop(self) -> None:
        self._stop_ev.set()
        self.app_state.set_running(False)
        self.app_state.set_fl_connected(False)
        self._btn.configure(text="▶  START", fg_color=BLUE,
                            hover_color=BLUE_HV)

    # ── Save handlers ─────────────────────────────────────────────────────────

    def _save_meet(self) -> None:
        if not self.cfg.has_section("meet"):
            self.cfg.add_section("meet")
        self.cfg.set("meet", "company_name", self._mv["company_name"].get())
        self.cfg.set("meet", "name",         self._mv["name"].get())
        self.cfg.set("meet", "date",         self._mv["date"].get())
        self.cfg.set("meet", "location",     self._mv["location"].get())
        _write_config(self.cfg)
        # Live-update the running processor — no restart needed
        if self._processor:
            self._processor.company_name  = self._mv["company_name"].get()
            self._processor.meet_name     = self._mv["name"].get()
            self._processor.meet_date     = self._mv["date"].get()
            self._processor.meet_location = self._mv["location"].get()

    def _save_settings(self) -> None:
        for dot_key, var in self._sv.items():
            section, key = dot_key.split(".", 1)
            if not self.cfg.has_section(section):
                self.cfg.add_section(section)
            self.cfg.set(section, key, var.get())
        # Save IdentiLynx toggle
        if not self.cfg.has_section("finishlynx"):
            self.cfg.add_section("finishlynx")
        self.cfg.set("finishlynx", "use_identilynx",
                     "true" if self._idl_var.get() else "false")
        _write_config(self.cfg)
        # Live-update running processor
        if self._processor:
            self._processor.identilynx_enabled = self._idl_var.get()
        messagebox.showinfo(
            "Settings Saved",
            "Settings written to config.ini.\n"
            "Stop and restart the agent to apply connection changes.",
            parent=self,
        )

    def _browse_lif(self) -> None:
        d = filedialog.askdirectory(title="Select LIF Directory", parent=self)
        if d:
            self._sv["finishlynx.lif_dir"].set(d)

    # ── Poll loop ─────────────────────────────────────────────────────────────

    def _poll(self) -> None:
        """Refresh status cards and activity log every 500 ms."""
        running = self.app_state.is_running()
        fl_conn = self.app_state.get_fl_connected()

        self._c_fl.set(fl_conn)
        self._c_lif.set(running)
        self._c_api.set(running)

        log = self.app_state.get_activity()
        latest_ts = log[0].timestamp if log else None
        if latest_ts != self._prev_latest_ts:
            self._prev_latest_ts = latest_ts
            for w in self._log_rows:
                w.destroy()
            self._log_rows.clear()
            if log:
                self._empty_label.pack_forget()
                for entry in log:
                    r = ActivityRow(self._log_frame, entry,
                                    f_body=self.f_body, f_xs=self.f_xs)
                    r.pack(fill="x", padx=6, pady=2)
                    self._log_rows.append(r)
            else:
                self._empty_label.pack(pady=20)

        self.after(500, self._poll)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
    font_family = _load_fonts()
    app = App(font_family=font_family)
    app.mainloop()


if __name__ == "__main__":
    main()
