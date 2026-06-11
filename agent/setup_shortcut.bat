@echo off
echo Creating FinishPics Agent desktop shortcut...

set SCRIPT_DIR=%~dp0
set TARGET=%SCRIPT_DIR%FinishPicsAgent.exe
set SHORTCUT=%USERPROFILE%\Desktop\FinishPics Agent.lnk

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT%'); " ^
  "$s.TargetPath = '%TARGET%'; " ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s.Description = 'FinishPics Agent'; " ^
  "$s.Save()"

if exist "%SHORTCUT%" (
    echo Done! Shortcut created on your Desktop.
) else (
    echo ERROR: Could not create shortcut. Try running as Administrator.
)
pause
