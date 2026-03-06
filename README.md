# Google Flow Suite

Monorepo TypeScript untuk akses Google Flow dengan 3 layer utama:

- **Core SDK** (`@google-flow-suite/core`)
- **CLI** (`@google-flow-suite/cli`)
- **HTTP API Server** (`@google-flow-suite/server`, OpenAI-compatible + native Flow route)

Project ini dibangun berdasarkan pola request endpoint Google Flow yang ter-capture, termasuk autentikasi session, upload media, generate image, workflow patch, dan media redirect.

## Fitur

- SDK untuk workflow Flow (project, media, prompt, auth session)
- CLI `flow` untuk operasi harian:
  - create project
  - generate image
  - upload reference
  - caption
  - fetch media
  - delete media
  - rename workflow
- HTTP API server:
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/images/generations`
  - `POST /v1/images/image-edit`
  - `POST /flow/projects/:projectId/generate`
  - `PATCH /flow/workflows/:workflowId`
- Retry + timeout per kelas endpoint
- Redaction logging untuk header sensitif

## Dokumentasi

- Halaman docs: [docs/README.md](./docs/README.md)
- System overview: [docs/01-system-overview.md](./docs/01-system-overview.md)
- Architecture: [docs/02-architecture.md](./docs/02-architecture.md)
- Core SDK guide: [docs/03-core-sdk.md](./docs/03-core-sdk.md)
- CLI tutorial: [docs/04-cli-tutorial.md](./docs/04-cli-tutorial.md)
- API server tutorial: [docs/05-api-server-tutorial.md](./docs/05-api-server-tutorial.md)
- Auth & environment: [docs/06-auth-and-env.md](./docs/06-auth-and-env.md)
- Bulk generation playbook: [docs/07-bulk-generation.md](./docs/07-bulk-generation.md)
- Troubleshooting: [docs/08-troubleshooting.md](./docs/08-troubleshooting.md)
- Security best practices: [docs/09-security-best-practices.md](./docs/09-security-best-practices.md)
- Development workflow: [docs/10-development-workflow.md](./docs/10-development-workflow.md)

## Struktur Repo

```text
google-flow-suite/
├─ packages/
│  ├─ core/      # SDK domain + HTTP client + adapters
│  ├─ cli/       # Command-line interface
│  └─ server/    # Fastify API server
├─ .env.example
├─ pnpm-workspace.yaml
└─ package.json
```

## Prasyarat

- Node.js 22+
- pnpm 9+
- Akun Google Flow yang valid
- Credential runtime (cookie dan/atau bearer token)

## Setup Cepat (Windows CMD)

```cmd
cd /d "D:\Kerja\Ngoding 2026\gemini-bot\google-flow-suite"
pnpm install
copy .env.example .env
pnpm -r build
```

Isi `.env` minimal:

```env
FLOW_COOKIE=<full Cookie header value>
FLOW_BEARER_TOKEN=<access_token dari /fx/api/auth/session>
FLOW_GOOGLE_API_KEY=
FLOW_TELEMETRY_MODE=enabled
FLOW_API_BASE_URL=https://aisandbox-pa.googleapis.com
FLOW_TRPC_BASE_URL=https://labs.google/fx/api/trpc
FLOW_LOCAL_API_KEY=
PORT=3000
```

## Cara Ambil Credential dari Browser

1. Buka `https://labs.google/fx/tools/flow` dan pastikan login.
2. Buka DevTools (`F12`) → tab **Network**.
3. Pilih request ke:
   - `https://labs.google/fx/api/auth/session`
4. Ambil:
   - **Cookie header penuh** (`Request Headers -> cookie`)
   - **access_token** dari response JSON
5. Set ke `.env`:
   - `FLOW_COOKIE=<cookie penuh>`
   - `FLOW_BEARER_TOKEN=<access_token>`

## Perintah Dasar Monorepo

Dari root repo:

```cmd
pnpm -r build
pnpm -r lint
pnpm -r typecheck
pnpm -r test
```

## CLI

Entry point CLI dibuild ke:

- `packages/cli/dist/index.js`

Format umum:

```cmd
pnpm exec node packages/cli/dist/index.js <command> [options]
```

### 1) Create project

```cmd
pnpm exec node packages/cli/dist/index.js project create --name "my-project"
```

### 2) Generate image

```cmd
pnpm exec node packages/cli/dist/index.js generate --project-id "<PROJECT_ID>" --prompt "cinematic cat astronaut"
```

Catatan:
- CLI akan auto-generate reCAPTCHA token jika `--recaptcha-token` tidak diberikan.
- Jika reCAPTCHA ditolak upstream, CLI retry 1x dengan token baru.

### 3) Upload reference image

```cmd
pnpm exec node packages/cli/dist/index.js upload --project-id "<PROJECT_ID>" --image "D:\path\ref.png"
```

### 4) Caption image

```cmd
pnpm exec node packages/cli/dist/index.js caption --image "D:\path\image.png" --count 3
```

### 5) Fetch media

```cmd
pnpm exec node packages/cli/dist/index.js fetch --media-id "<MEDIA_ID>" --output "./out.png"
```

### 6) Delete media

```cmd
pnpm exec node packages/cli/dist/index.js delete --media-id "<MEDIA_ID>"
```

### 7) Rename workflow

```cmd
pnpm exec node packages/cli/dist/index.js workflow rename --workflow-id "<WORKFLOW_ID>" --project-id "<PROJECT_ID>" --name "new-name"
```

### 8) Animate

```cmd
pnpm exec node packages/cli/dist/index.js animate --media-id "<MEDIA_ID>"
```

Catatan: endpoint animate saat ini feature-gated/disabled.

## API Server

### Jalankan server

```cmd
pnpm --filter @google-flow-suite/server build
pnpm --filter @google-flow-suite/server start
```

Server default:

- `http://127.0.0.1:3000`

### Health check

```cmd
curl http://127.0.0.1:3000/health
```

### List models

```cmd
curl http://127.0.0.1:3000/v1/models
```

### Generate image (OpenAI-compatible)

```cmd
curl -X POST http://127.0.0.1:3000/v1/images/generations ^
  -H "content-type: application/json" ^
  -d "{\"model\":\"nano-banana\",\"prompt\":\"api smoke test image\",\"project_id\":\"<PROJECT_ID>\",\"response_format\":\"url\",\"recaptcha_token\":\"<RECAPTCHA_TOKEN>\"}"
```

### Native Flow route generate

```cmd
curl -X POST http://127.0.0.1:3000/flow/projects/<PROJECT_ID>/generate ^
  -H "content-type: application/json" ^
  -d "{\"prompt\":\"test\",\"recaptcha_token\":\"<RECAPTCHA_TOKEN>\",\"model\":\"NARWHAL\"}"
```

### Rename workflow via API

```cmd
curl -X PATCH http://127.0.0.1:3000/flow/workflows/<WORKFLOW_ID> ^
  -H "content-type: application/json" ^
  -d "{\"projectId\":\"<PROJECT_ID>\",\"displayName\":\"new-name\"}"
```

## Proteksi API Key Lokal (opsional)

Set di `.env`:

```env
FLOW_LOCAL_API_KEY=my-local-key
```

Lalu request ke route proteksi wajib pakai:

```http
Authorization: Bearer my-local-key
```

## Bulk Generate ke Lokal (copy-paste)

Contoh cepat membuat banyak file dari daftar prompt.

### 1) Buat file prompt

```cmd
(
echo kucing astronaut cinematic
echo kota cyberpunk malam hujan
echo robot lucu watercolor
echo rumah kayu di pegunungan berkabut
echo naga biru fantasy ultra detail
) > prompts.txt
```

### 2) Jalankan loop generate + download

```cmd
powershell -NoProfile -Command "$prompts = Get-Content 'prompts.txt' | Where-Object { $_ -and $_.Trim() }; New-Item -ItemType Directory -Force -Path 'output' | Out-Null; $i = 1; foreach($p in $prompts){ Write-Host ('[GEN] ' + $p); $raw = pnpm exec node packages/cli/dist/index.js generate --project-id $env:PROJECT_ID --prompt $p 2>&1 | Out-String; $m = [regex]::Match($raw, '\"url\"\s*:\s*\"([^\"]+)\"'); if(-not $m.Success){ Write-Host '[ERR] URL tidak ketemu'; Write-Host $raw; continue }; $url = $m.Groups[1].Value; $file = ('output\img-{0:D3}.png' -f $i); Invoke-WebRequest -Uri $url -OutFile $file; Write-Host ('[OK] ' + $file); $i++ }"
```

### 3) Cek hasil

```cmd
dir output
```

## Troubleshooting

### Server start lalu langsung exit

Pastikan sudah build terbaru:

```cmd
pnpm --filter @google-flow-suite/server build
pnpm --filter @google-flow-suite/server start
```

### `Either cookie or bearer token must be provided`

Isi `FLOW_COOKIE` atau `FLOW_BEARER_TOKEN` di `.env`.

### `Invalid auth session payload` / `401` di endpoint TRPC

- Ambil ulang cookie penuh dari request browser yang masih valid.
- Ambil ulang `access_token` dari `/fx/api/auth/session`.
- Update `.env`, lalu jalankan ulang command.

### Generate sukses tapi gambar 0

Gunakan build terbaru (`pnpm -r build`) karena parser response sudah men-support struktur response `media[]` terbaru.

### Fetch media gagal redirect

Jika `fetch --media-id` tidak menemukan redirect URL, gunakan URL signed yang keluar dari hasil generate lalu download langsung:

```cmd
curl -L "<SIGNED_URL>" -o "result.png"
```

## Batasan Saat Ini

- `media.refine()` masih placeholder (belum call endpoint refine upstream).
- `animate` masih disabled (feature-gated).
- Endpoint status `/flow/jobs/:jobId/status` bersifat placeholder.

## Keamanan

- Jangan commit `.env` ke repository.
- Jangan share cookie atau bearer token di issue publik.
- Rotate credential jika pernah terpapar.
- Gunakan project ini hanya pada akun/akses yang Anda miliki izin.

## Catatan Endpoint yang Dipakai

Implementasi utama memakai endpoint keluarga berikut:

- `POST /v1/flow/uploadImage`
- `POST /v1/projects/{projectId}/flowMedia:batchGenerateImages`
- `PATCH /v1/flowWorkflows/{workflowId}`
- `GET /fx/api/trpc/media.getMediaUrlRedirect`
- `POST /fx/api/trpc/project.createProject`
- `GET /fx/api/auth/session`

Serta support telemetry endpoint sesuai konfigurasi core.
