# Troubleshooting

## `Either cookie or bearer token must be provided`

Penyebab:
- `FLOW_COOKIE` dan `FLOW_BEARER_TOKEN` kosong.

Solusi:
- Isi minimal salah satu di `.env`.

## `Invalid auth session payload` atau `401` TRPC / generate

Penyebab:
- Cookie expired.
- Server lokal berjalan dengan env lama.
- Token bootstrap stale dan tidak bisa dipakai lagi.

Solusi:
- Pastikan `.env` berisi `FLOW_GOOGLE_COOKIE` terbaru.
- Restart server lokal setelah update env.
- Jika masih perlu fallback lama, isi `FLOW_COOKIE` juga.
- Ulangi command.

## Generate sukses tapi file tidak terdownload

Penyebab umum:
- Response tidak berisi field yang diharapkan.
- `media_id` belum siap ketika langsung `fetch`.
- Response `data` hanya satu item dan dibaca PowerShell sebagai object tunggal, bukan array.

Solusi:
- Prioritaskan `url`/`b64_json` jika tersedia.
- Untuk `media_id`, gunakan retry dengan delay.
- Jika memproses response di PowerShell, normalisasi `data` dengan `@(...)` sebelum akses `.Count` atau indexing.
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

