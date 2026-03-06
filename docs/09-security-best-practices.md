# Security Best Practices

## Data Sensitif

Jangan expose data berikut:
- Cookie session.
- Bearer token.
- API key.
- Signed URL query signature.

## Aturan Repo

- `.env` harus tetap di-ignore.
- Hindari commit hasil capture mentah yang berpotensi memuat credential.
- Redact log sebelum dibagikan.

## Saat Debugging

- Share hanya potongan log yang perlu.
- Hapus header auth sebelum copy-paste.
- Gunakan environment terpisah untuk testing jika memungkinkan.

## Hardening Sederhana

- Aktifkan `FLOW_LOCAL_API_KEY` untuk server lokal yang diekspos ke jaringan.
- Batasi distribusi file output jika berisi data sensitif.
- Rotate credential setelah troubleshooting intensif.

