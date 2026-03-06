# System Overview

## Tujuan Sistem

Google Flow Suite adalah monorepo TypeScript untuk mengakses Google Flow lewat:
- SDK reusable (`@google-flow-suite/core`)
- CLI operasional (`@google-flow-suite/cli`)
- HTTP API server (`@google-flow-suite/server`)

## Komponen Utama

- `packages/core`: business logic dan integrasi endpoint Flow.
- `packages/cli`: command-line interface untuk operasi harian.
- `packages/server`: server Fastify dengan route OpenAI-compatible dan route native Flow.

## Use Cases Umum

- Generate gambar dari prompt.
- Upload gambar referensi ke project.
- Fetch hasil media menjadi file lokal.
- Rename workflow.
- Integrasi ke sistem internal lewat HTTP API.

## Alur Singkat Request

1. User memanggil CLI atau endpoint server.
2. `createFlowClient()` membentuk object `account`, `authSession`, `httpClient`, `endpoints`.
3. Domain object (`Project`, `Media`, dll) menyiapkan payload.
4. Request dikirim ke endpoint Google Flow/TRPC.
5. Hasil dipetakan ke format output CLI atau JSON API.

