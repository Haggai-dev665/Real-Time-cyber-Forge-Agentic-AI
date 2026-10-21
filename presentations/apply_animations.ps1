<#
  Adds the deck's animations with PowerPoint itself, so every effect is PowerPoint's own.

  Each animated shape's name, written by build_defence.py, ends in "|key=value;..." :
    fx    fade | fly | wipe | zoom | fadedzoom | rise | float | wheel | credits
    by    char | word | para        (text animation unit)
    t     after | with              (after or with the previous effect; the first effect follows the transition)
    d     delay in seconds          dur  duration in seconds
    dir   left | right | top | bottom
    pulse 1                         (adds a Pulse emphasis after the entrance)
    scroll / sdur / sd              (a motion path that scrolls the shape left by this fraction of the slide width)
  Shapes whose names start with "!!" are matched across slides by the Morph transition.

  .\apply_animations.ps1 -In _defence-static.pptx -Out "CyberForge - Thesis Defence v2.pptx" -Previews previews-v2
  The presentation is opened without a window in the running PowerPoint and closed again; PowerPoint itself is left open.
#>
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Previews = '',
  [switch]$EmbedFonts           # embed the fonts the deck uses (complete fonts, if the input asks for no subsetting)
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$inPath = (Resolve-Path (Join-Path $here $In)).Path
$outPath = Join-Path $here $Out

$fx = @{ fade = 10; fly = 2; wipe = 22; zoom = 23; fadedzoom = 48; rise = 34; float = 30; wheel = 21; credits = 28; appear = 1 }
$dirs = @{ left = 4; right = 2; top = 10; bottom = 11; up = 1; down = 3 }
$units = @{ char = 1; word = 2 }
$MORPH = 3954          # ppEffectMorphByObject (found by probing: not in this machine's older type library)
$FADE = 1793           # ppEffectFade, used if Morph is refused

$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($inPath, -1, 0, 0)   # read-only, titled, no window
$report = @()
try {
  foreach ($slide in $pres.Slides) {
    $seq = $slide.TimeLine.MainSequence
    $first = $true
    foreach ($shape in @($slide.Shapes)) {
      $name = $shape.Name
      $bar = $name.IndexOf('|')
      if ($bar -lt 0) { continue }
      $opts = @{}
      foreach ($kv in $name.Substring($bar + 1).Split(';')) { $p = $kv.Split('=', 2); if ($p.Count -eq 2) { $opts[$p[0]] = $p[1] } }
      $id = $fx[$opts['fx']]
      if (-not $id) { throw "slide $($slide.SlideIndex): unknown effect '$($opts['fx'])' on $name" }
      $trigger = if ($first -or $opts['t'] -ne 'with') { 3 } else { 2 }    # after previous / with previous
      $level = if ($opts['by'] -eq 'para') { 2 } else { 0 }
      $before = $seq.Count
      $eff = $seq.AddEffect($shape, $id, $level, $trigger)
      if ($opts['by'] -and $units.ContainsKey($opts['by'])) { $eff = $seq.ConvertToTextUnitEffect($eff, $units[$opts['by']]) }
      # every effect this shape produced (one per paragraph when animated by paragraph)
      for ($k = $before + 1; $k -le $seq.Count; $k++) {
        $e = $seq.Item($k)
        if ($opts['dur']) { $e.Timing.Duration = [double]$opts['dur'] }
        if ($k -eq $before + 1) {
          if ($opts['d']) { $e.Timing.TriggerDelayTime = [double]$opts['d'] }
        } else {
          $e.Timing.TriggerType = 3
        }
        if ($opts['dir'] -and $dirs.ContainsKey($opts['dir'])) { try { $e.EffectParameters.Direction = $dirs[$opts['dir']] } catch { } }
      }
      if ($opts['pulse'] -eq '1') {
        $pe = $seq.AddEffect($shape, 75, 0, 3)                    # Pulse emphasis
        $pe.Timing.Duration = 0.6
      }
      if ($opts['scroll']) {
        $m = $seq.AddEffect($shape, 120, 0, 3)                    # motion path, then made a straight scroll
        $m.Timing.Duration = [double]$opts['sdur']
        $m.Timing.TriggerDelayTime = [double]$opts['sd']
        $m.Timing.SmoothStart = -1; $m.Timing.SmoothEnd = -1
        $m.Behaviors.Item(1).MotionEffect.Path = "M 0 0 L $($opts['scroll']) 0 E"
      }
      # the name the audience never sees is cleaned of its instructions
      $shape.Name = $name.Substring(0, $bar)
      $first = $false
    }
    $t = $slide.SlideShowTransition
    $t.AdvanceOnClick = -1
    $t.AdvanceOnTime = 0
    try { $t.EntryEffect = $MORPH } catch { $t.EntryEffect = $FADE }
    if ($t.EntryEffect -ne $MORPH) { $t.EntryEffect = $FADE }
    $t.Duration = if ($slide.SlideIndex -eq 1) { 0.8 } else { 1.0 }
    $report += [pscustomobject]@{ Slide = $slide.SlideIndex; Effects = $seq.Count; Transition = $t.EntryEffect }
  }
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  $pres.SaveAs($outPath, 24, $(if ($EmbedFonts) { -1 } else { 0 }))   # ppSaveAsOpenXMLPresentation
  if ($Previews) {
    $dir = Join-Path $here $Previews
    New-Item -ItemType Directory -Force $dir | Out-Null
    foreach ($slide in $pres.Slides) { $slide.Export((Join-Path $dir ('slide-{0:D2}.png' -f $slide.SlideIndex)), 'PNG', 1600, 900) }
  }
} finally {
  $pres.Close()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($pres)
}
$report | Format-Table -AutoSize | Out-String
"saved: $outPath"
