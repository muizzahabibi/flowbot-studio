# Bulk Generation Playbook

## Tujuan

Menjalankan generate banyak gambar secara otomatis, dengan kontrol delay agar tidak terlalu agresif ke endpoint (mengurangi risiko captcha/reject).

## Opsi 1: Script Otomatis Khusus Kolam Renang

Gunakan script:
- `scripts/generate-20-kolam-renang.ps1`

Script ini sekarang full lewat local server:
- health check ke `GET /health`
- create project via `POST /flow/projects` bila `-ProjectId` tidak diisi
- generate via `POST /v1/images/generations`
- simpan hasil dari `b64_json` atau `url`
- tulis `manifest.csv` untuk semua iterasi

Contoh:

```powershell
powershell -NoExit -ExecutionPolicy Bypass -File .\scripts\generate-20-kolam-renang.ps1 -Count 20 -MinDelaySeconds 5 -MaxDelaySeconds 30 -KeepWindowOpen
```

Untuk run cepat tanpa jeda:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-20-kolam-renang.ps1 -Count 20 -MinDelaySeconds 0 -MaxDelaySeconds 0
```

## Opsi 2: Prompt File Kustom

1. Buat `prompts.txt`.
2. Loop per prompt.
3. Simpan hasil per iterasi ke folder output.

Lihat contoh command bulk di `README.md` untuk template cepat.

## Rekomendasi Anti-Gagal

- Gunakan jeda acak antar request.
- Simpan manifest hasil (`index`, `prompt`, `status`) agar gampang resume.
- Jika `media_id` belum bisa fetch, retry beberapa kali dengan interval kecil.

