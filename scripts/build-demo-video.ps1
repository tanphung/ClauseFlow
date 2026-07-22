param(
  [string]$OutputDirectory = "demo-video"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$output = Join-Path $repo $OutputDirectory
$raw = Join-Path $output "raw"
$final = Join-Path $output "ClauseFlow-GenLayer-Demo.mp4"
$thumbnail = Join-Path $output "ClauseFlow-Demo-Thumbnail.png"
$sceneFile = Join-Path $PSScriptRoot "demo-scenes.json"
$timingFile = Join-Path $output "timings.json"
$metadataFile = Join-Path $raw "recording-metadata.json"
$rawVideo = Join-Path $raw "clauseflow-demo.webm"

New-Item -ItemType Directory -Force $raw | Out-Null
$scenes = Get-Content $sceneFile -Raw | ConvertFrom-Json
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice("Microsoft Zira Desktop")
$voice.Rate = -1
$voice.Volume = 100

foreach ($scene in $scenes) {
  if ([string]::IsNullOrWhiteSpace($scene.narration)) { continue }
  $wav = Join-Path $raw ("voice-{0}.wav" -f $scene.id)
  $voice.SetOutputToWaveFile($wav)
  $voice.Speak($scene.narration)
  $voice.SetOutputToNull()
  $seconds = [double](& ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $wav)
  $scene.durationSeconds = [math]::Ceiling(($seconds + 1.6) * 10) / 10
}
$voice.Dispose()
$timingJson = $scenes | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($timingFile, $timingJson, (New-Object System.Text.UTF8Encoding($false)))

Push-Location $repo
try {
  node scripts/record-demo.mjs $timingFile $rawVideo $metadataFile
  if ($LASTEXITCODE -ne 0) { throw "Browser recording failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$concatLines = New-Object System.Collections.Generic.List[string]
foreach ($scene in $scenes) {
  $normalized = Join-Path $raw ("audio-{0}.wav" -f $scene.id)
  $duration = [double]$scene.durationSeconds
  if ([string]::IsNullOrWhiteSpace($scene.narration)) {
    & ffmpeg -y -v error -f lavfi -i "anullsrc=r=48000:cl=stereo" -t $duration -c:a pcm_s16le $normalized
  } else {
    $wav = Join-Path $raw ("voice-{0}.wav" -f $scene.id)
    & ffmpeg -y -v error -i $wav -af "aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,apad" -t $duration -c:a pcm_s16le $normalized
  }
  if ($LASTEXITCODE -ne 0) { throw "Audio preparation failed for scene $($scene.id)" }
  $escaped = $normalized.Replace("'", "'\''")
  $concatLines.Add("file '$escaped'")
}
$concatFile = Join-Path $raw "audio-concat.txt"
$concatLines | Set-Content $concatFile -Encoding ascii
$fullAudio = Join-Path $raw "narration.wav"
& ffmpeg -y -v error -f concat -safe 0 -i $concatFile -c:a pcm_s16le $fullAudio
if ($LASTEXITCODE -ne 0) { throw "Narration concatenation failed" }

$metadata = Get-Content $metadataFile -Raw | ConvertFrom-Json
$trim = [double]$metadata.preRollSeconds
& ffmpeg -y -v error -ss $trim -i $rawVideo -i $fullAudio `
  -filter_complex "[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]" `
  -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 21 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest $final
if ($LASTEXITCODE -ne 0) { throw "Final video encoding failed" }
& ffmpeg -y -v error -i $final -ss 1 -frames:v 1 $thumbnail
if ($LASTEXITCODE -ne 0) { throw "Demo thumbnail extraction failed" }

$videoInfo = & ffprobe -v error -show_entries format=duration,size -of json $final
Write-Host "DEMO_VIDEO_OK path=$final"
Write-Host "DEMO_THUMBNAIL_OK path=$thumbnail"
Write-Host $videoInfo
