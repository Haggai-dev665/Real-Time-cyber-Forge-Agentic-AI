# Put the CyberForge install folder, which holds cyberforge.exe, on the user's
# PATH. Run by the NSIS installer after it copies the files
# (installer/hooks.nsh). The folder comes from CF_INSTDIR, never from the
# command line. The registry value is read without expanding %VARIABLES% and
# written back with its original type, so other entries are kept as they were.
$ErrorActionPreference = 'Stop'
$dir = $env:CF_INSTDIR
if (-not $dir) { exit 2 }
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$path = [string]$key.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$kind = if ($key.GetValueNames() -contains 'Path') { $key.GetValueKind('Path') } else { [Microsoft.Win32.RegistryValueKind]::ExpandString }
$parts = @($path -split ';' | Where-Object { $_ -ne '' })
if ($parts -notcontains $dir) {
  $key.SetValue('Path', (($parts + $dir) -join ';'), $kind)
}
$key.Close()
# Tell running programs (Explorer, new terminals) that the environment changed.
[Environment]::SetEnvironmentVariable('CYBERFORGE_PATH_CHANGED', $null, 'User')
