# Development Workflow

## Setup

```bash
pnpm install
pnpm -r build
```

## Loop Harian

1. Ubah kode di package terkait.
2. Jalankan:
   - `pnpm -r lint`
   - `pnpm -r typecheck`
   - `pnpm -r test`
3. Build ulang paket yang berubah.
4. Validasi lewat CLI atau endpoint server.

## Struktur Kerja yang Disarankan

- Perubahan domain/integrasi: `packages/core`.
- Perubahan UX command: `packages/cli`.
- Perubahan API contract lokal: `packages/server`.

## Checklist Sebelum Commit

- Tidak ada secret di file.
- README/docs ikut diupdate jika ada perubahan perilaku.
- Test minimal package terdampak sudah hijau.
- Output generated yang tidak perlu sudah di-ignore.

