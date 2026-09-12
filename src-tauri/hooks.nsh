; NSIS installer hooks for Hephaestus
; Ensures clean upgrade without locked executable files and auto-relaunches the new version.

!macro NSIS_HOOK_PREINSTALL
  ; Terminate any running instance of Hephaestus so files can be overwritten cleanly
  nsExec::Exec 'cmd.exe /C taskkill /F /IM Hephaestus.exe >nul 2>&1'
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Auto-launch the updated Hephaestus application
  ExecShell "" "$INSTDIR\Hephaestus.exe"
!macroend
