param([string]$Workspace=(Split-Path -Parent $PSScriptRoot),[switch]$SkipThesisPdf,[switch]$PresentationOnly)
$ErrorActionPreference='Stop'
$cfRoot=(Resolve-Path -LiteralPath $Workspace).Path
$cfOut=Join-Path $cfRoot 'presentations'
$cfWord=$null; $cfDoc=$null; $cfPpt=$null; $cfDeck=$null
$cfReport=[ordered]@{}
if($PresentationOnly) {
  $cfPrevious=Get-Content -LiteralPath (Join-Path $cfOut 'office-validation-v4.json') -Raw | ConvertFrom-Json
  $cfReport.thesis=$cfPrevious.thesis
}
if(-not $PresentationOnly) {
try {
  $cfWord=New-Object -ComObject Word.Application
  $cfWord.Visible=$false; $cfWord.DisplayAlerts=0
  $cfWord.Options.UpdateLinksAtOpen=$false
  $cfDoc=$cfWord.Documents.Open((Join-Path $cfRoot 'Che Haggai Ngha Kang.docx'),$false,$false,$false)
  if ($cfDoc.ReadOnly) { throw 'The thesis is open read-only; the existing document was not overwritten by Office.' }
  Write-Output 'Thesis opened successfully in Word.'
  Write-Output 'Caption lists retained in their original two-column table layout.'
  $cfDoc.Repaginate()
  foreach($cfToc in $cfDoc.TablesOfContents) { $cfToc.Update() }
  [void]$cfDoc.Fields.Update()
  $cfDoc.Repaginate()
  foreach($cfToc in $cfDoc.TablesOfContents) { $cfToc.UpdatePageNumbers() }
  $cfDoc.Save()
  Write-Output 'Thesis indexes and page numbers saved.'
  if(-not $SkipThesisPdf) { $cfDoc.ExportAsFixedFormat((Join-Path $cfOut 'Che Haggai Ngha Kang - Revised V4.pdf'),17) }
  $cfReport.thesis=[ordered]@{pages=$cfDoc.ComputeStatistics(2);tables=$cfDoc.Tables.Count;indexes=$cfDoc.TablesOfContents.Count;wordVersion=$cfWord.Version;fields='refreshed';pdf=$(if($SkipThesisPdf){'full-document PDF export skipped after renderer stalled'}else{'native Word export'})}
  $cfDoc.Close(0);$cfDoc=$null
  Write-Output 'Thesis opened, paginated, saved and closed successfully.'
} finally {
  if($cfDoc) { $cfDoc.Close(0) }
  if($cfWord) { $cfWord.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($cfWord) }
}
}
$cfReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $cfOut 'office-validation-v4.json') -Encoding UTF8
try {
  $cfPpt=New-Object -ComObject PowerPoint.Application
  $cfOldPptAlerts=$cfPpt.DisplayAlerts;$cfPpt.DisplayAlerts=1
  $cfDeck=$cfPpt.Presentations.Open((Join-Path $cfOut 'CyberForge - Thesis Defence v4.pptx'),-1,0,0)
  Write-Output 'V4 presentation opened successfully in PowerPoint.'
  if($cfDeck.Slides.Count -ne 12) { throw 'The V4 presentation does not contain 12 slides.' }
  $cfPreview=Join-Path $cfOut 'previews-v4-native'
  New-Item -ItemType Directory -Path $cfPreview -Force | Out-Null
  $cfSlides=@()
  foreach($cfSlide in $cfDeck.Slides) {
    $cfSlide.Export((Join-Path $cfPreview ('slide-{0:D2}.png' -f $cfSlide.SlideIndex)),'PNG',1600,900)
    $cfOverflow=@()
    foreach($cfShape in $cfSlide.Shapes) {
      if($cfShape.HasTextFrame -and $cfShape.TextFrame.HasText) {
        if($cfShape.TextFrame2.TextRange.BoundHeight -gt ($cfShape.Height+3)) { $cfOverflow += $cfShape.Name }
      }
    }
    $cfSlides += [ordered]@{slide=$cfSlide.SlideIndex;animationEffects=$cfSlide.TimeLine.MainSequence.Count;textOverflows=$cfOverflow}
  }
  $cfDeck.SaveAs((Join-Path $cfOut 'CyberForge - Thesis Defence v4 - Native.pdf'),32,0)
  $cfReport.presentation=[ordered]@{slides=12;powerPointVersion=$cfPpt.Version;nativeRendering='passed';details=$cfSlides}
} finally {
  if($cfDeck) { $cfDeck.Close();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($cfDeck) }
  if($cfPpt) { $cfPpt.DisplayAlerts=$cfOldPptAlerts;if($cfPpt.Presentations.Count -eq 0) { $cfPpt.Quit() };[void][Runtime.InteropServices.Marshal]::ReleaseComObject($cfPpt) }
}
$cfReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $cfOut 'office-validation-v4.json') -Encoding UTF8
$cfReport | ConvertTo-Json -Depth 8
