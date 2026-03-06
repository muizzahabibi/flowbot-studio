# Troubleshooting

## `Either cookie or bearer token must be provided`

Penyebab:
- `FLOW_COOKIE` dan `FLOW_BEARER_TOKEN` kosong.

Solusi:
- Isi minimal salah satu di `.env`.

## `Invalid auth session payload` atau `401` TRPC

Penyebab:
- Cookie expired / token tidak valid.

Solusi:
- Ambil ulang cookie + access token dari browser.
- Update `.env`.
- Ulangi command.

## Generate sukses tapi file tidak terdownload

Penyebab umum:
- Response tidak berisi field yang diharapkan.
- `media_id` belum siap ketika langsung `fetch`.

Solusi:
- Prioritaskan `url`/`b64_json` jika tersedia.
- Untuk `media_id`, gunakan retry dengan delay.
- Simpan raw response untuk analisa.

## Server langsung exit

Solusi:
- Build ulang:

```bash
pnpm --filter @flowbot-studio/server build
pnpm --filter @flowbot-studio/server start
```

## reCAPTCHA sering gagal saat bulk

Solusi:
- Perbesar jeda antar request.
- Hindari burst request.
- Tambahkan retry terbatas untuk request gagal.

