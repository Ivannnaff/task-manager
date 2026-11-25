# WhatsApp Bot — Pengingat Deadline Tugas

Bot WhatsApp berbasis **Baileys** yang mengingatkan tugas yang deadline-nya mepet. Session disimpan di tabel Supabase `wa_sessions`, jadi tidak perlu scan QR tiap kali restart.

## Cara pakai (lokal)

1. Instal dependensi:
   ```bash
   npm install
   ```

2. Buat `.env` dari contoh:
   ```bash
   cp .env.example .env
   ```
   Isi minimal `WA_TARGET_NUMBER`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan `API_URL`.

3. Jalankan sekali untuk pairing:
   ```bash
   npm start
   ```
   Scan QR yang muncul, atau isi `WA_PAIRING_NUMBER` untuk pakai pairing code. Session akan tersimpan di Supabase.

4. Pastikan backend bisa diakses lewat `API_URL` (lokal `http://localhost:3000/api`, atau URL Vercel).

## Jadwal & aturan

- Cek otomatis **07.00** dan **20.00** WIB (diubah lewat `CRON_MORNING` / `CRON_EVENING`).
- Hanya tugas **belum selesai** yang dikirimi pesan jika deadline: `H-2`, `H-1`, hari ini, atau sudah terlambat.
- **Anti-spam**: tiap kondisi maksimal 1× per slot per hari, dicatat di tabel `wa_logs`.
- Mode pesan: `DIGEST=true` menggabung semua tugas jadi 1 pesan.

## Deploy: GitHub Actions (disarankan)

Karena bot cuma perlu jalan 2x sehari, lebih murah dan lebih stabil menjalankannya sebagai *scheduled job* daripada menyewa server yang nyala terus.

- Workflow: `.github/workflows/wa-bot.yml` → `0 0 * * *` (07.00 WIB) dan `0 13 * * *` (20.00 WIB).
- Mode `--once`: connect → kirim → keluar. Penjadwalannya dipegang GitHub, bukan `node-cron` di dalam bot.
- Pairing tetap dilakukan **sekali secara lokal** supaya session masuk ke `wa_sessions`.

Secrets yang wajib diisi di GitHub → *Settings → Secrets and variables → Actions*:

| Secret | Isi |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | Anon key (untuk `wa_logs`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (untuk session) |
| `WA_TARGET_NUMBER` | Nomor tujuan, format `628xxxxxxxxxx` |
| `API_URL` | `https://<backend>.vercel.app/api` |

Opsional: `URGENT_THRESHOLD`, `ANTI_SPAM`, `DIGEST`, `MAX_SENDS_PER_DAY`.

Tes manual: tab **Actions** → workflow *WhatsApp Deadline Reminder* → **Run workflow** → pilih slot `TEST`.

Kalau bot lama masih jalan di Railway/VPS, **matikan** supaya pesan nggak dobel.

## Catatan

- `MAX_SENDS_PER_DAY` memakai file lokal `.send-count.json`, yang tidak persist di GitHub Actions. Biarkan `0` kalau memakai workflow.
- Kalau WhatsApp logout, workflow akan gagal dan session dihapus otomatis — lakukan pairing ulang secara lokal.
- Bot ini proses Node mandiri, bukan bagian dari Next.js dan tidak bisa jalan di Vercel serverless.

## Tabel yang dibutuhkan

`wa_sessions` dan `wa_logs` — keduanya ada di `supabase-setup.sql` / `migrate-notes-wa.sql`.
