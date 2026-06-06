<#
  CyberForge - Windows uninstaller / data purge.

  The app itself is removed via Windows "Add or remove programs" (the NSIS/MSI
  installer registers a proper uninstaller). This script does the part the OS
  uninstaller intentionally leaves behind: it removes the per-user CyberForge
  DATA directory and the PATH entry, and can launch the app uninstaller for you.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1            # interactive
    powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1 -Force     # no prompts
    powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1 -KeepData  # remove app, keep data
#>
param(
  [switch]$Force,
  [switch]$KeepData
)

$ErrorActionPreference = 'Stop'
$App      = 'CyberForge'
$DataDir  = Join-Path $env:APPDATA 'com.cyberforge.console'
$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\CyberForge'
$BinDir   = Join-Path $InstallDir 'bin'

function Confirm($msg) {
  if ($Force) { return $true }
  $a = Read-Host "$msg [y/N]"
  return ($a -eq 'y' -or $a -eq 'Y')
}

Write-Host "CyberForge uninstaller" -ForegroundColor Cyan
Write-Host "  Data directory : $DataDir"
Write-Host "  Install dir    : $InstallDir"
Write-Host ""

# 1) Close the app if it is running.
Get-Process -Name 'CyberForge','cyberforge-console' -ErrorAction SilentlyContinue |
  ForEach-Object { Write-Host "Stopping $($_.ProcessName) (pid $($_.Id))"; Stop-Process -Id $_.Id -Force }

# 2) Remove the bin directory from the user PATH.
try {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if ($userPath -and $userPath.Split(';') -contains $BinDir) {
    $newPath = ($userPath.Split(';') | Where-Object { $_ -and $_ -ne $BinDir }) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "Removed from PATH: $BinDir" -ForegroundColor Green
  }
} catch { Write-Warning "Could not update PATH: $($_.Exception.Message)" }

# 3) Launch the registered app uninstaller (Add/Remove Programs), if present.
$uninst = Get-ChildItem -Path $InstallDir -Filter 'uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($uninst) {
  if (Confirm "Run the CyberForge app uninstaller now?") {
    Write-Host "Launching $($uninst.FullName) ..."
    Start-Process -FilePath $uninst.FullName -Wait
  }
} else {
  Write-Host "No bundled uninstaller found under $InstallDir." -ForegroundColor Yellow
  Write-Host "Remove the app via Settings > Apps > Installed apps > CyberForge." -ForegroundColor Yellow
}

# 4) Purge the per-user data directory (unless asked to keep it).
if ($KeepData) {
  Write-Host "Keeping data directory: $DataDir" -ForegroundColor Yellow
} elseif (Test-Path $DataDir) {
  if (Confirm "Delete all CyberForge data (scans, memory, blocklists, token) in $DataDir?") {
    Remove-Item -Path $DataDir -Recurse -Force
    Write-Host "Removed data directory." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
