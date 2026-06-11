@echo off
echo ============================================================
echo  FinishPics Agent -- Build Installer
echo ============================================================
echo.

:: Install / upgrade dependencies
echo Installing Python dependencies...
pip install --upgrade pyinstaller customtkinter watchdog requests Pillow
if errorlevel 1 (
    echo ERROR: pip install failed. Make sure Python is in your PATH.
    pause
    exit /b 1
)

:: Clean previous build
if exist dist\FinishPicsAgent rmdir /s /q dist\FinishPicsAgent
if exist build rmdir /s /q build

:: Build
echo.
echo Building executable...
pyinstaller FinishPicsAgent.spec
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    pause
    exit /b 1
)

:: Copy config template and shortcut script into dist folder
echo.
echo Copying config and setup files...
copy config.ini.example dist\FinishPicsAgent\config.ini
copy setup_shortcut.bat dist\FinishPicsAgent\setup_shortcut.bat

echo.
echo ============================================================
echo  Build complete!
echo  Output folder: agent\dist\FinishPicsAgent\
echo.
echo  Before zipping and sending:
echo    1. Edit dist\FinishPicsAgent\config.ini with their details
echo    2. Zip the entire FinishPicsAgent folder
echo    3. Tell them to unzip, edit config.ini for each meet,
echo       and run setup_shortcut.bat once to create a shortcut.
echo ============================================================
pause
