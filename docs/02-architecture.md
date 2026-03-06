# Architecture

## Layering

- Entry layer:
  - CLI entry: `packages/cli/src/index.ts`
  - Server entry: `packages/server/src/main.ts`
- Service layer:
  - `packages/core/src/domain/*`
- Integration layer:
  - `packages/core/src/client/flow-http-client.ts`
  - `packages/core/src/client/flow-endpoints.ts`
- Auth layer:
  - `packages/core/src/auth/flow-auth-session.ts`

## Data Flow

1. Request diterima dari CLI/server.
2. Config gabungan dibangun dari argumen + env.
3. Auth token disiapkan dari bearer token atau refresh via cookie session.
4. HTTP client inject headers, timeout, retry policy.
5. Endpoint wrapper memanggil URL target.
6. Response divalidasi lalu dipetakan ke output domain/API.

## Pattern yang Dipakai

- Explicit validation (throw error cepat jika input invalid).
- Retry dengan exponential backoff + jitter untuk status retryable.
- Redaction logging agar header sensitif tidak bocor.
- Adapter pattern untuk OpenAI-compatible image API.

## Batasan Arsitektural Saat Ini

- Beberapa endpoint bersifat placeholder (`refine`, `animate`, job status).
- Header browser fingerprint masih hardcoded untuk kompatibilitas upstream.
- Ketergantungan terhadap perilaku endpoint Google Flow yang bisa berubah.

