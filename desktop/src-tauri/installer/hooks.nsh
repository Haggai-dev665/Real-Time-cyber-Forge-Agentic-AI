; The cyberforge CLI on PATH, for the NSIS (per-user) installer (V2-01).
; The CLI is installed beside CyberForge.exe as cyberforge.exe; these hooks add
; the install folder to the user's PATH and take it off again on uninstall. The
; folder reaches PowerShell through CF_INSTDIR, never inside the command, and
; the scripts are installed with the app (installer/path-*.ps1).

!macro NSIS_HOOK_POSTINSTALL
  System::Call 'Kernel32::SetEnvironmentVariable(t "CF_INSTDIR", t "$INSTDIR")'
  nsExec::Exec 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\installer\path-add.ps1"'
  Pop $0
  DetailPrint "cyberforge CLI on PATH: exit $0"
  DetailPrint "Preparing the pinned ML pack from Hugging Face..."
  nsExec::ExecToLog '"$INSTDIR\${MAINBINARYNAME}.exe" --prepare-local-ml'
  Pop $0
  ${If} $0 == 0
    DetailPrint "Local ML pack downloaded and SHA-256 verified."
  ${Else}
    DetailPrint "Download deferred; verified bundled detectors work offline. Retry in Model capabilities."
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  System::Call 'Kernel32::SetEnvironmentVariable(t "CF_INSTDIR", t "$INSTDIR")'
  nsExec::Exec 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\installer\path-remove.ps1"'
  Pop $0
  DetailPrint "cyberforge CLI off PATH: exit $0"
  ; The tray's "Start with Windows" entry (src/tray.rs), so no start-up entry
  ; is left pointing at a removed program.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CyberForge"
!macroend
