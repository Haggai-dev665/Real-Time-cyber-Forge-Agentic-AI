# Take the CyberForge install folder off the user's PATH again. Run by the NSIS
# uninstaller before it removes the files (installer/hooks.nsh). Only that one
# entry is removed; everything else is written back unexpanded, with the
# value's original type.
$ErrorActionPreference = 'Stop'
$dir = $env:CF_INSTDIR
if (-not $dir) { exit 2 }
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
if ($key.GetValueNames() -contains 'Path') {
  $path = [string]$key.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
  $kind = $key.GetValueKind('Path')
  $kept = @($path -split ';' | Where-Object { $_ -ne '' -and $_ -ne $dir })
  $key.SetValue('Path', ($kept -join ';'), $kind)
}
$key.Close()
[Environment]::SetEnvironmentVariable('CYBERFORGE_PATH_CHANGED', $null, 'User')
