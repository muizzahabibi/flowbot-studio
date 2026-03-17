# Auth dan Environment

## Variabel Utama

- `FLOW_GOOGLE_COOKIE`: cookie penuh dari sesi Google browser. Ini jadi sumber utama bootstrap auth.
- `FLOW_COOKIE`: fallback legacy untuk kompatibilitas lama.
- `FLOW_BEARER_TOKEN`: token akses bootstrap opsional dari endpoint session.
- `FLOW_GOOGLE_API_KEY`: opsional untuk endpoint tertentu.
- `FLOW_API_BASE_URL`: default `https://aisandbox-pa.googleapis.com`.
- `FLOW_TRPC_BASE_URL`: default `https://labs.google/fx/api/trpc`.
- `FLOW_LOCAL_API_KEY`: API key lokal untuk proteksi route server.

## Strategi Auth

1. Jika caller mengirim `config.cookie`, nilai itu dipakai lebih dulu.
2. Jika tidak ada, core memakai `FLOW_GOOGLE_COOKIE`, lalu fallback ke `FLOW_COOKIE`.
3. Jika hanya ada bearer token bootstrap tanpa cookie, token dipakai sampai TTL bootstrap habis.
4. Jika cookie tersedia, core akan refresh token dari `https://labs.google/fx/api/auth/session` saat token stale atau saat sesi perlu diambil ulang.
5. Jika cookie invalid/expired dan payload session memang tidak lagi memberi token usable, auth gagal dan perlu cookie baru.

## Cara Ambil Credential

1. Login ke `https://labs.google/fx/tools/flow`.
2. Buka DevTools > Network.
3. Cari request `GET /fx/api/auth/session`.
4. Ambil:
   - Header `cookie` penuh.
   - Field `access_token` dari response.

## Rekomendasi Operasional

- Jangan commit `.env`.
- Rotate cookie/token jika pernah terpapar.
- Gunakan akun dan akses yang memang kamu miliki izin.

