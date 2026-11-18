param([string]$Workspace=(Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
$cfRoot=(Resolve-Path -LiteralPath $Workspace).Path
$cfOut=Join-Path $cfRoot 'presentations'
$cfPpt=$null; $cfDeck=$null
$cfSlides=@()

function Inspect-CfShapes($Shapes, $SlideIndex, $Parent='') {
  $cfFindings=@()
  foreach($cfShape in $Shapes) {
    if($cfShape.Type -eq 6) {
      $cfFindings += @(Inspect-CfShapes $cfShape.GroupItems $SlideIndex ($Parent + $cfShape.Name + '/'))
    } elseif($cfShape.HasTextFrame -and $cfShape.TextFrame.HasText) {
      $cfHeight=$cfShape.TextFrame2.TextRange.BoundHeight
      $cfWidth=$cfShape.TextFrame2.TextRange.BoundWidth
      if($cfHeight -gt ($cfShape.Height+3) -or $cfWidth -gt ($cfShape.Width+3)) {
        $cfFindings += [ordered]@{shape=$Parent+$cfShape.Name;id=$cfShape.Id;text=$cfShape.TextFrame.TextRange.Text;
          boundHeight=[math]::Round($cfHeight,2);height=[math]::Round($cfShape.Height,2);
          boundWidth=[math]::Round($cfWidth,2);width=[math]::Round($cfShape.Width,2)}
      }
    }
  }
  return $cfFindings
}

try {
  $cfPpt=New-Object -ComObject PowerPoint.Application
  $cfOldAlerts=$cfPpt.DisplayAlerts; $cfPpt.DisplayAlerts=1
  $cfDeck=$cfPpt.Presentations.Open((Join-Path $cfOut 'CyberForge - Thesis Defence v7.pptx'),-1,0,0)
  Write-Output 'V7 opened successfully in native PowerPoint.'
  if($cfDeck.Slides.Count -ne 16) { throw "Expected 16 slides." }
  $cfPreview=Join-Path $cfOut 'previews-v7-native'
  New-Item -ItemType Directory -Path $cfPreview -Force | Out-Null
  foreach($cfSlide in $cfDeck.Slides) {
    $cfSlide.Export((Join-Path $cfPreview ('slide-{0:D2}.png' -f $cfSlide.SlideIndex)),'PNG',1600,900)
    $cfFindings=@(Inspect-CfShapes $cfSlide.Shapes $cfSlide.SlideIndex)
    $cfSlides += [ordered]@{slide=$cfSlide.SlideIndex;animationEffects=$cfSlide.TimeLine.MainSequence.Count;
      transition=$cfSlide.SlideShowTransition.EntryEffect;textOverflows=$cfFindings}
    Write-Output ('Rendered slide {0}: {1} native animation effects; {2} text fit findings.' -f $cfSlide.SlideIndex,$cfSlide.TimeLine.MainSequence.Count,$cfFindings.Count)
  }
  $cfDeck.SaveAs((Join-Path $cfOut 'CyberForge - Thesis Defence v7 - Preview.pdf'),32,0)
  $cfReport=[ordered]@{slides=16;powerPointVersion=$cfPpt.Version;nativeRendering='passed';
    outputPdf='CyberForge - Thesis Defence v7 - Preview.pdf';details=$cfSlides}
  $cfReport | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $cfOut 'office-validation-v7.json') -Encoding UTF8
  $cfReport | ConvertTo-Json -Depth 12
} finally {
  if($cfDeck) { $cfDeck.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cfDeck) }
  if($cfPpt) {
    $cfPpt.DisplayAlerts=$cfOldAlerts
    if($cfPpt.Presentations.Count -eq 0) { $cfPpt.Quit() }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cfPpt)
  }
}
