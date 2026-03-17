# FlowBot Studio

[![Node.js](https://img.shields.io/badge/node-22%2B-339933.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

Monorepo TypeScript untuk akses workflow image generation berbasis endpoint Google Flow, terdiri dari:
- **Core SDK** (`@flowbot-studio/core`)
- **CLI** (`@flowbot-studio/cli`)
- **HTTP API Server** (`@flowbot-studio/server`, OpenAI-compatible + native route)

## Disclaimer Penting

> [!WARNING]
> Proyek ini dibuat **murni untuk edukasi, riset, dan eksperimen pribadi**.
> 
> Proyek ini **tidak berafiliasi, tidak disponsori, dan tidak didukung** oleh Google, Gemini, maupun entitas resmi terkait lainnya.
> 
> Penggunaan reverse-engineered/web endpoint mungkin melanggar ToS layanan pihak ketiga. Semua risiko penggunaan ditanggung pengguna.

## Fitur

- SDK modular untuk operasi project/media/prompt/auth.
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
- Retry + timeout per kelas endpoint.
- Redaction logging untuk header/token sensitif.

## Dokumentasi

- Docs index: [docs/README.md](./docs/README.md)
- System overview: [docs/01-system-overview.md](./docs/01-system-overview.md)
- Architecture: [docs/02-architecture.md](./docs/02-architecture.md)
- Core SDK guide: [docs/03-core-sdk.md](./docs/03-core-sdk.md)
- CLI tutorial: [docs/04-cli-tutorial.md](./docs/04-cli-tutorial.md)
- API server tutorial: [docs/05-api-server-tutorial.md](./docs/05-api-server-tutorial.md)
- Auth & env: [docs/06-auth-and-env.md](./docs/06-auth-and-env.md)
- Bulk generation: [docs/07-bulk-generation.md](./docs/07-bulk-generation.md)
- Troubleshooting: [docs/08-troubleshooting.md](./docs/08-troubleshooting.md)
- Security: [docs/09-security-best-practices.md](./docs/09-security-best-practices.md)
- Dev workflow: [docs/10-development-workflow.md](./docs/10-development-workflow.md)

## Struktur Repo

```text
flowbot-studio/
├─ packages/
│  ├─ core/      # SDK domain + HTTP client + adapters
│  ├─ cli/       # Command-line interface
│  └─ server/    # Fastify API server
├─ docs/
├─ scripts/
├─ .env.example
├─ pnpm-workspace.yaml
└─ package.json
```

## Quick Start

### Prasyarat

- Node.js 22+
- pnpm 9+
- Credential runtime valid (cookie dan/atau bearer token)

### Setup

```cmd
cd /d "D:\Kerja\Ngoding 2026\gemini-bot\flowbot-studio"
pnpm install
copy .env.example .env
pnpm -r build
```

Isi minimal `.env`:

```env
FLOW_GOOGLE_COOKIE=<full Google Cookie header value>
FLOW_COOKIE=<legacy fallback cookie header value>
FLOW_BEARER_TOKEN=<optional bootstrap token>
FLOW_GOOGLE_API_KEY=
FLOW_TELEMETRY_MODE=enabled
FLOW_API_BASE_URL=https://aisandbox-pa.googleapis.com
FLOW_TRPC_BASE_URL=https://labs.google/fx/api/trpc
FLOW_LOCAL_API_KEY=
PORT=3000
```

Prioritas auth bootstrap sekarang:
- `config.cookie`
- `FLOW_GOOGLE_COOKIE`
- `FLOW_COOKIE`

Jika cookie tersedia, server/core akan refresh token dari sesi Google Flow saat bearer token stale atau tidak dipakai lagi.

## Monorepo Commands

```cmd
pnpm -r build
pnpm -r lint
pnpm -r typecheck
pnpm -r test
```

## CLI Usage

Entry point:
- `packages/cli/dist/index.js`

Format:

```cmd
pnpm exec node packages/cli/dist/index.js <command> [options]
```

Contoh:

```cmd
pnpm exec node packages/cli/dist/index.js project create --name "my-project"
pnpm exec node packages/cli/dist/index.js generate --project-id "<PROJECT_ID>" --prompt "cinematic pool villa"
pnpm exec node packages/cli/dist/index.js upload --project-id "<PROJECT_ID>" --image "D:\path\ref.png"
pnpm exec node packages/cli/dist/index.js fetch --media-id "<MEDIA_ID>" --output "./output/result.png"
pnpm exec node packages/cli/dist/index.js workflow rename --workflow-id "<WORKFLOW_ID>" --project-id "<PROJECT_ID>" --name "new-name"
```

Catatan:
- CLI auto-generate reCAPTCHA token bila `--recaptcha-token` tidak disuplai.
- Jika upstream menolak reCAPTCHA, CLI retry satu kali dengan token baru.

## API Server Usage

Jalankan server:

```cmd
pnpm --filter @flowbot-studio/server build
pnpm --filter @flowbot-studio/server start
```

Default URL:
- `http://127.0.0.1:3000`

Contoh request:

```cmd
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/v1/models
```

Generate OpenAI-compatible:

```cmd
curl -X POST http://127.0.0.1:3000/v1/images/generations ^
  -H "content-type: application/json" ^
  -d "{\"model\":\"nano-banana\",\"prompt\":\"api pool test\",\"project_id\":\"<PROJECT_ID>\",\"response_format\":\"url\",\"recaptcha_token\":\"<RECAPTCHA_TOKEN>\"}"
```

## Bulk Generate (Otomatis)

Script siap pakai:
- `scripts/generate-20-kolam-renang.ps1`

Contoh:

```powershell
powershell -NoExit -ExecutionPolicy Bypass -File .\scripts\generate-20-kolam-renang.ps1 -Count 20 -MinDelaySeconds 5 -MaxDelaySeconds 30 -KeepWindowOpen
```

## Troubleshooting Cepat

- `Either cookie or bearer token must be provided`:
  - isi `FLOW_COOKIE` atau `FLOW_BEARER_TOKEN`.
- `Invalid auth session payload` / `401`:
  - refresh cookie + access token dari browser.
- Generate sukses tapi media tidak ke-download:
  - gunakan fallback `url`/`b64_json`, atau retry fetch `media_id`.

## Keamanan

- Jangan commit `.env` dan credential aktif.
- Jangan publish request dump mentah yang berisi cookie/token.
- Rotate credential jika pernah terekspos.
- Gunakan hanya akun/akses yang kamu miliki izin.

## Batasan Saat Ini

- `media.refine()` masih placeholder.
- `animate` masih feature-gated/disabled.
- `/flow/jobs/:jobId/status` bersifat placeholder.

## Disclaimer (Legal)

Proyek ini adalah proyek independen komunitas untuk tujuan pembelajaran.  
Tidak ada hubungan resmi dengan Google, Gemini, OpenAI, atau afiliasi korporat terkait.  
Pengguna bertanggung jawab penuh untuk kepatuhan hukum, kebijakan platform, dan risiko operasionalnya sendiri.

