param(
  [string]$LiveUrl = "https://lovely-eel-809.convex.site",
  [string]$OutputDirectory = "demo-output"
)

$ErrorActionPreference = "Stop"
$npRoot = Split-Path -Parent $PSScriptRoot
$npOutput = Join-Path $npRoot $OutputDirectory
$npNarration = Join-Path $npRoot "docs\video\VOICEOVER.txt"
$npVoice = Join-Path $npOutput "noticeproof-voiceover.wav"
$npRaw = Join-Path $npOutput "noticeproof-raw.webm"
$npSubtitles = Join-Path $npOutput "noticeproof-captions.srt"
$npFinal = Join-Path $npOutput "NoticeProof-demo.mp4"
New-Item -ItemType Directory -Force -Path $npOutput | Out-Null

Add-Type -AssemblyName System.Speech
$npSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$npSynth.SelectVoice("Microsoft Zira Desktop")
$npSynth.Rate = 1
$npSynth.Volume = 100
$npSynth.SetOutputToWaveFile($npVoice)
$npSynth.Speak((Get-Content $npNarration -Raw -Encoding UTF8))
$npSynth.Dispose()

$npAudioSeconds = [double](ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $npVoice)
$npTargetMs = [Math]::Min(178000, [Math]::Max(90000, [Math]::Ceiling(($npAudioSeconds + 2.5) * 1000)))
$env:NOTICEPROOF_DEMO_DURATION_MS = [string]$npTargetMs
node (Join-Path $npRoot "scripts\recordDemo.mjs") $LiveUrl $npOutput
if ($LASTEXITCODE -ne 0) { throw "Browser recording failed" }

function Format-SrtTime([double]$Seconds) {
  $npSpan = [TimeSpan]::FromSeconds($Seconds)
  return "{0:00}:{1:00}:{2:00},{3:000}" -f [Math]::Floor($npSpan.TotalHours), $npSpan.Minutes, $npSpan.Seconds, $npSpan.Milliseconds
}

$npScenes = @(
  @(0.00, 0.14, "A real recall can still arrive through an unsafe channel."),
  @(0.14, 0.28, "Deliberate intake. No whole-inbox access. Live sponsor proof."),
  @(0.28, 0.46, "OpenAI structures the notice into source-spanned claims."),
  @(0.46, 0.64, "Firecrawl acquires Tier 1 evidence. Rules, not rank, decide."),
  @(0.64, 0.79, "New verified thread. Exact recipient and payload. Explicit approval."),
  @(0.79, 0.83, "Convex realtime timeline and append-only evidence receipt."),
  @(0.83, 0.95, "Authority beats appearance, even for a generic email provider."),
  @(0.95, 1.00, "Don't click the recall. Prove it.")
)
$npSrt = New-Object System.Collections.Generic.List[string]
for ($npIndex = 0; $npIndex -lt $npScenes.Count; $npIndex++) {
  $npScene = $npScenes[$npIndex]
  $npSrt.Add([string]($npIndex + 1))
  $npSrt.Add("$(Format-SrtTime ($npScene[0] * $npTargetMs / 1000)) --> $(Format-SrtTime ($npScene[1] * $npTargetMs / 1000))")
  $npSrt.Add([string]$npScene[2])
  $npSrt.Add("")
}
Set-Content -LiteralPath $npSubtitles -Value $npSrt -Encoding UTF8

$npEscapedSubs = $npSubtitles.Replace("\", "/").Replace(":", "\:")
ffmpeg -y -i $npRaw -i $npVoice -vf "subtitles='$npEscapedSubs':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H55000000,BorderStyle=3,BackColour=&HCC071B17,MarginV=34,Alignment=2'" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart $npFinal
if ($LASTEXITCODE -ne 0) { throw "Final video render failed" }

$npFinalSeconds = [double](ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $npFinal)
[pscustomobject]@{
  output = $npFinal
  durationSeconds = [Math]::Round($npFinalSeconds, 2)
  sizeBytes = (Get-Item $npFinal).Length
  voice = "Microsoft Zira Desktop"
} | ConvertTo-Json -Compress
