# Auth dan Environment

## Variabel Utama

- `FLOW_COOKIE`: cookie penuh dari sesi browser.
- `FLOW_BEARER_TOKEN`: token akses dari endpoint session.
- `FLOW_GOOGLE_API_KEY`: opsional untuk endpoint tertentu.
- `FLOW_API_BASE_URL`: default `https://aisandbox-pa.googleapis.com`.
- `FLOW_TRPC_BASE_URL`: default `https://labs.google/fx/api/trpc`.
- `FLOW_LOCAL_API_KEY`: API key lokal untuk proteksi route server.

## Strategi Auth

1. Jika bearer token masih valid, token dipakai langsung.
2. Jika token expired, core mencoba refresh via `FLOW_COOKIE`.
3. Jika cookie invalid/expired, request auth gagal dan perlu cookie baru.

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

