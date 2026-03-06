[CmdletBinding()]
param(
  [string]$ProjectId = $env:PROJECT_ID,
  [string]$FlowCookie = $env:FLOW_COOKIE,
  [string]$Model = "nano-banana",
  [int]$Count = 20,
  [int]$MinDelaySeconds = 5,
  [int]$MaxDelaySeconds = 30,
  [int]$FetchRetries = 5,
  [int]$FetchRetryDelaySeconds = 3,
  [string]$OutputDir = ("output/pools-" + (Get-Date -Format "yyyyMMdd-HHmmss")),
  [switch]$KeepWindowOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
# Hindari native stderr dilempar sebagai terminating error agar output CLI bisa ditangkap utuh.
if ($PSVersionTable.PSVersion.Major -ge 7) {
  $PSNativeCommandUseErrorActionPreference = $false
}

if ($Count -lt 1) { throw "Count minimal 1." }
if ($MinDelaySeconds -lt 0) { throw "MinDelaySeconds tidak boleh negatif." }
if ($MaxDelaySeconds -lt $MinDelaySeconds) { throw "MaxDelaySeconds harus >= MinDelaySeconds." }
if ($FetchRetries -lt 1) { throw "FetchRetries minimal 1." }
if ($FetchRetryDelaySeconds -lt 1) { throw "FetchRetryDelaySeconds minimal 1." }
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot
$pnpmCmd = "pnpm.cmd"

function Get-EnvFileValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Test-Path $FilePath)) { return $null }
  $lines = Get-Content -Path $FilePath -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    if ($line -match "^\s*$Name=(.*)$") {
      return $Matches[1]
    }
  }
  return $null
}

if (-not $FlowCookie) {
  $FlowCookie = Get-EnvFileValue -FilePath ".env" -Name "FLOW_COOKIE"
}
if (-not $FlowCookie) {
  throw @"
FLOW_COOKIE belum diisi.
Set di environment atau tambahkan ke .env:
FLOW_COOKIE=<cookie dari browser labs.google>
"@
}

$coreDist = "packages/core/dist/index.js"
$cliEntry = "packages/cli/dist/index.js"

function Get-LatestWriteTimeUtc {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathPattern
  )

  $items = Get-ChildItem -Path $PathPattern -Recurse -File -ErrorAction SilentlyContinue
  if (-not $items -or $items.Count -eq 0) { return [datetime]::MinValue }
  return ($items | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
}

$needsBuild = (-not (Test-Path $coreDist)) -or (-not (Test-Path $cliEntry))
if (-not $needsBuild) {
  $latestSourceUtc = @(
    Get-LatestWriteTimeUtc -PathPattern "packages/core/src/*.ts"
    Get-LatestWriteTimeUtc -PathPattern "packages/cli/src/*.ts"
  ) | Sort-Object -Descending | Select-Object -First 1

  $latestDistUtc = @(
    (Get-Item $coreDist).LastWriteTimeUtc
    (Get-Item $cliEntry).LastWriteTimeUtc
  ) | Sort-Object -Descending | Select-Object -First 1

  if ($latestSourceUtc -gt $latestDistUtc) {
    $needsBuild = $true
  }
}

if ($needsBuild) {
  Write-Host "[INIT] Build core+cli karena dist belum ada / sudah kedaluwarsa..."
  & $pnpmCmd --filter @flowbot-studio/core --filter @flowbot-studio/cli build
  if ($LASTEXITCODE -ne 0) { throw "Build gagal. Periksa error di atas." }
}

function Invoke-FlowCli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  # Force refresh auth token from FLOW_COOKIE and avoid stale FLOW_BEARER_TOKEN from .env.
  $allArgs = @("exec", "node", $cliEntry) + $Args + @("--cookie", $FlowCookie, "--bearer-token=")
  $escapedArgs = $allArgs | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $pnpmCmd
  $psi.Arguments = ($escapedArgs -join " ")
  $psi.WorkingDirectory = (Get-Location).Path
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $null = $proc.Start()
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()

  $raw = @($stdout, $stderr) -join [Environment]::NewLine
  if ($proc.ExitCode -ne 0) {
    throw "Command gagal: flow $($Args -join ' ')`n$raw"
  }
  return $raw.Trim()
}

function ConvertFrom-CliJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Raw
  )

  $lines = $Raw -split "`r?`n"
  $start = -1
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].TrimStart().StartsWith("{")) {
      $start = $i
      break
    }
  }

  if ($start -lt 0) {
    throw "JSON output tidak ditemukan.`n$Raw"
  }

  $jsonText = ($lines[$start..($lines.Length - 1)] -join "`n").Trim()
  return ($jsonText | ConvertFrom-Json)
}

function Get-PropValue {
  param(
    [Parameter(Mandatory = $true)]
    [object]$InputObject,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $p = $InputObject.PSObject.Properties[$Name]
  if ($null -eq $p) { return $null }
  return $p.Value
}

function Test-FlowSession {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Cookie
  )

  try {
    $resp = Invoke-WebRequest -Uri "https://labs.google/fx/api/auth/session" -Headers @{ cookie = $Cookie } -Method GET -TimeoutSec 30
    return ($resp.StatusCode -eq 200)
  } catch {
    return $false
  }
}

if (-not (Test-FlowSession -Cookie $FlowCookie)) {
  throw @"
FLOW_COOKIE tidak valid/expired (session endpoint tidak bisa diakses dengan cookie ini).
Cara refresh:
1) Login ulang ke https://labs.google/fx/tools/flow di browser.
2) Buka DevTools -> Network, lakukan aksi create project.
3) Ambil header request 'cookie' dari request ke labs.google/fx/api/trpc/project.createProject (atau /fx/api/auth/session).
4) Update FLOW_COOKIE di .env, lalu jalankan ulang script.

Catatan: file HAR ini tersanitasi (tidak menyimpan cookie), jadi cookie tidak bisa dipulihkan dari labs.google.har.
"@
}

if (-not $ProjectId) {
  Write-Host "[INIT] PROJECT_ID tidak ada, membuat project baru..."
  $projectRaw = Invoke-FlowCli -Args @("project", "create", "--name", ("pool-auto-" + (Get-Date -Format "yyyyMMdd-HHmmss")))
  $projectJson = ConvertFrom-CliJson -Raw $projectRaw
  $ProjectId = $projectJson.projectId
  if (-not $ProjectId) { throw "Gagal mendapatkan projectId dari output project create." }
  Write-Host "[INIT] Project dibuat: $ProjectId"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$prompts = @(
  "luxury infinity swimming pool at sunset, tropical villa, cinematic lighting, ultra detailed",
  "modern rooftop swimming pool in a city skyline, blue hour, realistic photo style",
  "minimalist indoor swimming pool with natural light, concrete and wood, architectural photography",
  "family backyard swimming pool with palm trees and clear sky, bright daylight",
  "resort swimming pool with waterfall feature, lush garden, high detail",
  "olympic swimming pool with lane markers, clean geometry, sharp realistic image",
  "night swimming pool with warm ambient lights and reflections, premium hotel vibe",
  "mountain view swimming pool with misty morning atmosphere, photorealistic",
  "mediterranean style swimming pool courtyard, white stone, summer mood",
  "desert luxury swimming pool with cabanas and turquoise water, high contrast",
  "eco-friendly natural swimming pool with stones and plants, serene composition",
  "rainy day swimming pool scene with dramatic clouds and reflections, cinematic",
  "aerial top-down view of a geometric swimming pool complex, modern design",
  "swimming pool with glass walls overlooking ocean cliffs, epic perspective",
  "japanese zen style swimming pool with bamboo and soft lighting, calm mood",
  "tropical rain forest swimming pool hidden among dense trees, moody realism",
  "winter heated outdoor swimming pool with steam and snow around, realistic detail",
  "boutique hotel swimming pool with artistic tiles and sunbeds, premium editorial look",
  "large public swimming pool park in summer, lively atmosphere, high detail",
  "private villa swimming pool at golden hour with elegant architecture, photorealistic"
)

$manifestPath = Join-Path $OutputDir "manifest.csv"
"index,prompt,media_id,file,status" | Set-Content -Path $manifestPath

Write-Host "[START] Generate $Count gambar kolam renang ke folder: $OutputDir"

for ($i = 1; $i -le $Count; $i++) {
  $prompt = $prompts[($i - 1) % $prompts.Count]
  $file = Join-Path $OutputDir ("pool-{0:D2}.png" -f $i)
  $status = "ok"
  $mediaId = ""

  try {
    Write-Host "[GEN $i/$Count] $prompt"
    $generateRaw = Invoke-FlowCli -Args @(
      "generate",
      "--project-id", $ProjectId,
      "--prompt", $prompt,
      "--model", $Model
    )
    $generateJson = ConvertFrom-CliJson -Raw $generateRaw
    if (-not $generateJson.data -or $generateJson.data.Count -lt 1) {
      $status = "no_data"
      Write-Warning "[WARN $i/$Count] Response generate tidak punya data gambar."
      throw "Generate response kosong"
    }

    $first = $generateJson.data[0]
    $b64 = Get-PropValue -InputObject $first -Name "b64_json"
    $url = Get-PropValue -InputObject $first -Name "url"
    $mediaIdRaw = Get-PropValue -InputObject $first -Name "media_id"

    if ($b64) {
      $bytes = [Convert]::FromBase64String([string]$b64)
      [IO.File]::WriteAllBytes($file, $bytes)
      Write-Host "[SAVE $i/$Count] Base64 disimpan ke $file"
    } elseif ($url) {
      Invoke-WebRequest -Uri ([string]$url) -OutFile $file
      Write-Host "[SAVE $i/$Count] URL disimpan ke $file"
    } elseif ($mediaIdRaw) {
      $mediaId = [string]$mediaIdRaw
      $fetchOk = $false
      $lastFetchError = ""

      for ($attempt = 1; $attempt -le $FetchRetries; $attempt++) {
        try {
          Write-Host "[FETCH $i/$Count][$attempt/$FetchRetries] media_id=$mediaId -> $file"
          $null = Invoke-FlowCli -Args @("fetch", "--media-id", $mediaId, "--output", $file)
          if (Test-Path $file) {
            $fetchOk = $true
            break
          }
          $lastFetchError = "Fetch sukses tapi file belum ada."
        } catch {
          $lastFetchError = $_.Exception.Message
        }

        if ($attempt -lt $FetchRetries) {
          Start-Sleep -Seconds $FetchRetryDelaySeconds
        }
      }

      if (-not $fetchOk) {
        throw "Fetch gagal setelah $FetchRetries percobaan. Last error: $lastFetchError"
      }
    } else {
      $status = "no_media_data"
      Write-Warning "[WARN $i/$Count] Tidak ada media_id/b64_json/url di response."
    }
  } catch {
    $status = "failed: $($_.Exception.Message -replace '[\r\n]+', ' ')"
    Write-Host "[ERR $i/$Count] $status" -ForegroundColor Red
  }

  $safePrompt = '"' + ($prompt -replace '"', '""') + '"'
  $safeMedia = '"' + ($mediaId -replace '"', '""') + '"'
  $safeFile = '"' + ($file -replace '"', '""') + '"'
  $safeStatus = '"' + ($status -replace '"', '""') + '"'
  "$i,$safePrompt,$safeMedia,$safeFile,$safeStatus" | Add-Content -Path $manifestPath

  if ($i -lt $Count) {
    $delay = Get-Random -Minimum $MinDelaySeconds -Maximum ($MaxDelaySeconds + 1)
    Write-Host "[WAIT] tidur $delay detik..."
    Start-Sleep -Seconds $delay
  }
}

Write-Host "[DONE] Selesai. Cek hasil di: $OutputDir"
Write-Host "[DONE] Manifest: $manifestPath"
Write-Host "[DONE] Project ID: $ProjectId"
if ($KeepWindowOpen) {
  Write-Host ""
  Read-Host "Tekan Enter untuk menutup"
}

