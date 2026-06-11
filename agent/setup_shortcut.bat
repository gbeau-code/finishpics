@echo off
echo Creating FinishPics Agent desktop shortcut...

set SCRIPT_DIR=%~dp0

powershell -NoProfile -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$lnk = Join-Path $desktop 'FinishPics Agent.lnk'; " ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut($lnk); " ^
  "$s.TargetPath = '%SCRIPT_DIR%FinishPicsAgent.exe'; " ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s.Description = 'FinishPics Agent'; " ^
  "$s.Save(); " ^
  "if (Test-Path $lnk) { Write-Host 'Done! Shortcut created on your Desktop.' } else { Write-Host 'ERROR: Could not create shortcut.' }"

pause
