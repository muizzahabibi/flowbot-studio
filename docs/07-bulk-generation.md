# Bulk Generation Playbook

## Tujuan

Menjalankan generate banyak gambar secara otomatis, dengan kontrol delay agar tidak terlalu agresif ke endpoint (mengurangi risiko captcha/reject).

## Opsi 1: Script Otomatis Khusus Kolam Renang

Gunakan script:
- `scripts/generate-20-kolam-renang.ps1`

Contoh:

```powershell
powershell -NoExit -ExecutionPolicy Bypass -File .\scripts\generate-20-kolam-renang.ps1 -Count 20 -MinDelaySeconds 5 -MaxDelaySeconds 30 -KeepWindowOpen
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

