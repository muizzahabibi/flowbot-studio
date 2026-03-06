# Core SDK Guide

## Import dan Inisialisasi

```ts
import { createFlowClient } from "@google-flow-suite/core";

const client = createFlowClient({
  cookie: process.env.FLOW_COOKIE,
  bearerToken: process.env.FLOW_BEARER_TOKEN,
});
```

## Objek Penting

- `client.project(projectId)`: operasi project-based.
- `client.media`: operasi media (`fetch`, `save`, `delete`, `caption`).
- `client.openai`: adapter OpenAI-compatible (`generate`, `imageEdit`).
- `client.createProject(displayName?)`: buat project baru.

## Contoh Generate

```ts
const project = client.project("<PROJECT_ID>");
const result = await project.generateImageWithReferences(
  "luxury swimming pool",
  [],
  { recaptchaToken: "<TOKEN>", model: "NARWHAL" }
);
```

## Prinsip Error Handling

- Validasi input melempar `FlowValidationError`.
- Kegagalan auth melempar `FlowAuthError`.
- Error HTTP upstream dibungkus `FlowError`.

Gunakan `try/catch` pada boundary aplikasi untuk menangkap dan menampilkan pesan yang bersih.

