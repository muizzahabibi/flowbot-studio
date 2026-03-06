# API Server Tutorial

## Menjalankan Server

```bash
pnpm --filter @flowbot-studio/server build
pnpm --filter @flowbot-studio/server start
```

Default URL: `http://127.0.0.1:3000`

## Endpoint Utama

- `GET /health`
- `GET /v1/models`
- `POST /v1/images/generations`
- `POST /v1/images/image-edit`
- `POST /flow/projects/:projectId/generate`
- `PATCH /flow/workflows/:workflowId`

## Contoh OpenAI-Compatible Generate

```bash
curl -X POST http://127.0.0.1:3000/v1/images/generations \
  -H "content-type: application/json" \
  -d "{\"model\":\"nano-banana\",\"prompt\":\"pool at sunset\",\"project_id\":\"<PROJECT_ID>\",\"response_format\":\"url\",\"recaptcha_token\":\"<RECAPTCHA_TOKEN>\"}"
```

## Contoh Route Native Flow

```bash
curl -X POST http://127.0.0.1:3000/flow/projects/<PROJECT_ID>/generate \
  -H "content-type: application/json" \
  -d "{\"prompt\":\"pool render\",\"recaptcha_token\":\"<RECAPTCHA_TOKEN>\",\"model\":\"NARWHAL\"}"
```

## API Key Lokal (Opsional)

Jika `FLOW_LOCAL_API_KEY` di-set, route proteksi harus membawa:

```http
Authorization: Bearer <FLOW_LOCAL_API_KEY>
```

