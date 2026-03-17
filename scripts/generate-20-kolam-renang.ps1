[CmdletBinding()]
param(
  [string]$ProjectId = $env:PROJECT_ID,
  [string]$FlowCookie = $env:FLOW_COOKIE,
  [string]$FlowServerBaseUrl = $(if ($env:FLOW_SERVER_BASE_URL) { $env:FLOW_SERVER_BASE_URL } else { "http://127.0.0.1:3000" }),
  [string]$FlowLocalApiKey = $env:FLOW_LOCAL_API_KEY,
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
$FlowServerBaseUrl = $FlowServerBaseUrl.TrimEnd('/')

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

if (-not $FlowLocalApiKey) {
  $FlowLocalApiKey = Get-EnvFileValue -FilePath ".env" -Name "FLOW_LOCAL_API_KEY"
}

function Get-FlowServerHeaders {
  $headers = @{}
  if ($FlowLocalApiKey) {
    $headers["Authorization"] = "Bearer $FlowLocalApiKey"
  }
  return $headers
}

function Get-FlowServerUri {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ($Path.StartsWith("/")) {
    return "$FlowServerBaseUrl$Path"
  }

  return "$FlowServerBaseUrl/$Path"
}

function Get-StructuredErrorMessage {
  param(
    [Parameter(Mandatory = $true)]
    [object]$ErrorPayload
  )

  $errorBody = Get-PropValue -InputObject $ErrorPayload -Name "error"
  if ($null -eq $errorBody) {
    return $null
  }

  $parts = @()
  $message = Get-PropValue -InputObject $errorBody -Name "message"
  $code = Get-PropValue -InputObject $errorBody -Name "code"
  $retryable = Get-PropValue -InputObject $errorBody -Name "retryable"
  $recoveryAttempted = Get-PropValue -InputObject $errorBody -Name "recoveryAttempted"
  $manualActionRequired = Get-PropValue -InputObject $errorBody -Name "manualActionRequired"

  if ($message) { $parts += [string]$message }
  if ($code) { $parts += "code=$code" }
  if ($null -ne $retryable) { $parts += "retryable=$retryable" }
  if ($null -ne $recoveryAttempted) { $parts += "recoveryAttempted=$recoveryAttempted" }
  if ($null -ne $manualActionRequired) { $parts += "manualActionRequired=$manualActionRequired" }

  if ($parts.Count -eq 0) {
    return $null
  }

  return ($parts -join " | ")
}

function Read-ErrorResponseBody {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Response
  )

  $stream = $Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)

  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
    $stream.Dispose()
  }
}

function New-FlowServerErrorMessage {
  param(
    [Parameter(Mandatory = $true)]
    [int]$StatusCode,
    [Parameter(Mandatory = $true)]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [string]$RawBody
  )

  if ($RawBody) {
    try {
      $payload = $RawBody | ConvertFrom-Json
      $structuredMessage = Get-StructuredErrorMessage -ErrorPayload $payload
      if ($structuredMessage) {
        return "Server error $StatusCode untuk $Method ${Uri}: $structuredMessage"
      }
    } catch {
    }

    return "Server error $StatusCode untuk $Method ${Uri}: $RawBody"
  }

  return "Server error $StatusCode untuk $Method $Uri"
}

function Invoke-FlowServerJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [object]$Body
  )

  $uri = Get-FlowServerUri -Path $Path
  $headers = Get-FlowServerHeaders

  try {
    if ($PSBoundParameters.ContainsKey("Body") -and $null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 10
      return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -ContentType "application/json" -Body $jsonBody
    }

    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) {
      throw "Request ke local server gagal ($Method $uri): $($_.Exception.Message)"
    }

    $statusCode = [int]$response.StatusCode
    $rawBody = Read-ErrorResponseBody -Response $response
    throw (New-FlowServerErrorMessage -StatusCode $statusCode -Method $Method -Uri $uri -RawBody $rawBody)
  }
}

function Invoke-FlowServerDownload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$OutFile
  )

  $uri = Get-FlowServerUri -Path $Path
  $headers = Get-FlowServerHeaders

  try {
    Invoke-WebRequest -Uri $uri -Headers $headers -OutFile $OutFile | Out-Null
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) {
      throw "Download dari local server gagal ($uri): $($_.Exception.Message)"
    }

    $statusCode = [int]$response.StatusCode
    $rawBody = Read-ErrorResponseBody -Response $response
    throw (New-FlowServerErrorMessage -StatusCode $statusCode -Method "GET" -Uri $uri -RawBody $rawBody)
  }
}

function Test-FlowServerHealth {
  try {
    $health = Invoke-FlowServerJson -Method "GET" -Path "/health"
    return ($null -ne $health -and (Get-PropValue -InputObject $health -Name "status") -eq "ok")
  } catch {
    throw @"
Local server tidak bisa dijangkau di $FlowServerBaseUrl.
Jalankan server lokal dulu lalu ulangi script ini.
Detail: $($_.Exception.Message)
"@
  }
}

$RecaptchaSiteKey = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV"
$RecaptchaCo = "aHR0cHM6Ly9sYWJzLmdvb2dsZTo0NDM."
$RecaptchaVersion = "QvLuXwupqtKMva7GIh5eGl3U"

function Get-RecaptchaToken {
  $cb = [System.Guid]::NewGuid().ToString("N")
  $anchorUri = "https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=$RecaptchaSiteKey&co=$([uri]::EscapeDataString($RecaptchaCo))&hl=en&v=$RecaptchaVersion&size=invisible&cb=$cb"
  $headers = @{
    "accept" = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    "accept-language" = "en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7"
    "user-agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
  }

  $anchorResponse = Invoke-WebRequest -Uri $anchorUri -Headers $headers -Method GET -TimeoutSec 30
  $anchorTokenMatch = [regex]::Match($anchorResponse.Content, 'id="recaptcha-token"[^>]*value="([^"]+)"')
  if (-not $anchorTokenMatch.Success) {
    throw "Gagal mendapatkan reCAPTCHA anchor token."
  }

  $reloadBody = "v=$([uri]::EscapeDataString($RecaptchaVersion))&reason=q&k=$([uri]::EscapeDataString($RecaptchaSiteKey))&c=$([uri]::EscapeDataString($anchorTokenMatch.Groups[1].Value))&sa=IMAGE_GENERATION&co=$([uri]::EscapeDataString($RecaptchaCo))"
  $reloadHeaders = @{
    "content-type" = "application/x-www-form-urlencoded"
    "user-agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
    "referer" = "https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=$RecaptchaSiteKey&co=$RecaptchaCo&hl=en&v=$RecaptchaVersion&size=invisible&anchor-ms=20000&execute-ms=30000&cb=l7qwgzhkq6fu"
  }

  $reloadResponse = Invoke-WebRequest -Uri "https://www.google.com/recaptcha/enterprise/reload?k=$RecaptchaSiteKey" -Method POST -Headers $reloadHeaders -Body $reloadBody -TimeoutSec 30
  $tokenMatch = [regex]::Match($reloadResponse.Content, '"rresp","([^"]+)"')
  if (-not $tokenMatch.Success) {
    throw "Gagal mendapatkan reCAPTCHA token."
  }

  return $tokenMatch.Groups[1].Value
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

if (-not (Test-FlowServerHealth)) {
  throw "Health check local server gagal di $FlowServerBaseUrl"
}

Write-Host "[INIT] Local server sehat: $FlowServerBaseUrl"
Write-Host "[INIT] Script ini memakai local server; recovery/cookie dikelola server env (mis. FLOW_GOOGLE_COOKIE)."

if (-not $ProjectId) {
  Write-Host "[INIT] PROJECT_ID tidak ada, membuat project baru via local server..."
  $projectJson = Invoke-FlowServerJson -Method "POST" -Path "/flow/projects" -Body @{
    displayName = "pool-auto-" + (Get-Date -Format "yyyyMMdd-HHmmss")
  }
  $ProjectId = Get-PropValue -InputObject $projectJson -Name "projectId"
  if (-not $ProjectId) { throw "Gagal mendapatkan projectId dari response server." }
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
    Write-Host "[GEN $i/$Count] Membuat token reCAPTCHA..."
    $recaptchaToken = Get-RecaptchaToken

    $generateJson = Invoke-FlowServerJson -Method "POST" -Path "/v1/images/generations" -Body @{
      model = $Model
      prompt = $prompt
      project_id = $ProjectId
      recaptcha_token = $recaptchaToken
      response_format = "b64_json"
    }

    $data = @(Get-PropValue -InputObject $generateJson -Name "data")
    if ($data.Count -lt 1) {
      $status = "no_data"
      Write-Warning "[WARN $i/$Count] Response generate tidak punya data gambar."
      throw "Generate response kosong"
    }

    $first = $data[0]
    $b64 = Get-PropValue -InputObject $first -Name "b64_json"
    $url = Get-PropValue -InputObject $first -Name "url"
    $mediaIdRaw = Get-PropValue -InputObject $first -Name "media_id"

    if ($b64) {
      $bytes = [Convert]::FromBase64String([string]$b64)
      [IO.File]::WriteAllBytes($file, $bytes)
      Write-Host "[SAVE $i/$Count] Base64 disimpan ke $file"
    } elseif ($url -and ([string]$url).StartsWith("http", [System.StringComparison]::OrdinalIgnoreCase)) {
      Invoke-WebRequest -Uri ([string]$url) -OutFile $file
      Write-Host "[SAVE $i/$Count] URL disimpan ke $file"
    } elseif ($mediaIdRaw) {
      $mediaId = [string]$mediaIdRaw
      $fetchOk = $false
      $lastFetchError = ""

      for ($attempt = 1; $attempt -le $FetchRetries; $attempt++) {
        try {
          Write-Host "[FETCH $i/$Count][$attempt/$FetchRetries] media_id=$mediaId -> $file"
          Invoke-FlowServerDownload -Path "/flow/media/$mediaId/content" -OutFile $file
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

