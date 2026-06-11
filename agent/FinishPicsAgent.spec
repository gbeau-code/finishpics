# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_all

ctk_datas, ctk_binaries, ctk_hiddenimports = collect_all('customtkinter')
darkdetect_datas, darkdetect_binaries, darkdetect_hiddenimports = collect_all('darkdetect')

a = Analysis(
    ['gui.py'],
    pathex=[],
    binaries=ctk_binaries + darkdetect_binaries,
    datas=[
        ('fonts', 'fonts'),
        *ctk_datas,
        *darkdetect_datas,
    ],
    hiddenimports=ctk_hiddenimports + darkdetect_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='FinishPicsAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='FinishPicsAgent',
)
