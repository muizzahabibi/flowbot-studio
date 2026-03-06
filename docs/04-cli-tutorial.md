# CLI Tutorial

## Prasyarat

1. Sudah `pnpm install`.
2. Sudah `pnpm -r build`.
3. `.env` berisi kredensial valid.

## Format Dasar

```bash
pnpm exec node packages/cli/dist/index.js <command> [options]
```

## Alur Praktis Cepat

1. Buat project:

```bash
pnpm exec node packages/cli/dist/index.js project create --name "pool-demo"
```

2. Generate image:

```bash
pnpm exec node packages/cli/dist/index.js generate --project-id "<PROJECT_ID>" --prompt "modern swimming pool at sunset"
```

3. Fetch media:

```bash
pnpm exec node packages/cli/dist/index.js fetch --media-id "<MEDIA_ID>" --output "./output/pool.png"
```

4. Rename workflow:

```bash
pnpm exec node packages/cli/dist/index.js workflow rename --workflow-id "<WORKFLOW_ID>" --project-id "<PROJECT_ID>" --name "new-workflow-name"
```

## Tips Stabilitas

- Jika reCAPTCHA sering ditolak, tambahkan jeda antar generate.
- Simpan output JSON generate untuk debugging.
- Jika `media_id` belum siap fetch, coba ulang beberapa detik kemudian.

