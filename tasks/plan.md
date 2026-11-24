# Rencana Implementasi: Demo Pentest Publik TokoKita

## Ringkasan
Tambahkan endpoint SQLi khusus untuk sqlmap yang hanya membaca fixture sintetis terisolasi; perbarui runbook agar sesuai aplikasi backend dan deployment saat ini. Latihan Burp menggunakan celah yang sudah ada. Latihan Nmap hanya menargetkan TokoKita lokal, bukan domain/IP Railway.

## Keputusan arsitektur
- Pertahankan Python stdlib dan SQLite; tanpa dependency baru.
- Endpoint sqlmap hanya query ke tabel khusus berisi fixture dummy. Query dan hasil dibatasi, tanpa mutasi; input parameter dibatasi 4096 karakter.
- Panduan sqlmap memakai teknik boolean/error; hindari ekstraksi time-based yang lambat.
- Jangan mengarahkan tool otomatis ke endpoint akun/pesanan/ulasan atau infrastruktur hosting.
- Perbarui dokumentasi presenter dalam Bahasa Indonesia; panduan lama di Downloads menjadi referensi, bukan sumber kebenaran implementasi.
- Tidak deploy ke Railway tanpa persetujuan eksplisit baru.

## Daftar tugas

### Fase 1 — Data dan skenario lab
- [x] Tugas 1: Tambah 12 akun demo sintetis, termasuk akun Kamila admin dan Rohandhika pembeli.
- [x] Tugas 2: Batasi collector XSS ke cookie akun Kamila admin demo, yang dikendalikan presenter.
- [x] Tugas 3: Tetapkan kontrak endpoint dan fixture sintetis terpisah untuk sqlmap.
- [x] Tugas 4: Implementasikan endpoint SQLi read-only dengan batas input/waktu/hasil.
- [x] Tugas 5: Tambahkan tes jumlah akun, gating cookie collector, isolasi DB, input invalid/besar, dan non-mutasi.

### Checkpoint — lab lokal
- [x] `python3 tests/smoke_test.py` lulus.
- [x] Tes baru membuktikan data di luar fixture tidak dibaca/diubah dan collector menolak cookie pembeli.
- [x] sqlmap mendeteksi endpoint fixture di localhost; curl menunjukkan empat record sintetis.

### Fase 2 — Panduan presenter
- [x] Tugas 6: Tulis `docs/demo-runbook.md` dalam Bahasa Indonesia: Burp, sqlmap lokal terbatas, Nmap localhost saja, dampak, mitigasi, reset, fallback; susun alur basic-ke-deep.
- [x] Tugas 7: Koreksi README dan tautkan runbook baru.

### Checkpoint — dokumentasi
- [x] Semua command menyasar aplikasi yang tepat dan punya hasil yang diharapkan.
- [x] Tidak ada instruksi scan terhadap hostname/IP Railway atau dump data akun.
- [x] Runbook menjelaskan alur presentasi bertingkat dan akun dummy.

### Fase 3 — Verifikasi rilis (hanya setelah persetujuan deploy)
- [ ] Tugas 6: Verifikasi lokal penuh dan tinjau diff; siapkan state seed bersih.
- [ ] Tugas 7: Jika pengguna memberi persetujuan deploy terpisah, deploy dan cek versi publik, batas lab, serta kebersihan data.

### Checkpoint — selesai
- [ ] Tes lokal lulus dan semua kriteria spesifikasi terpenuhi.
- [ ] Tidak ada deploy tanpa persetujuan eksplisit.
- [ ] Jika deployment disetujui, state demo bersih dan endpoint lab terbatas.

## Risiko dan mitigasi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| sqlmap menjangkau tabel akun/order | Kebocoran data | Endpoint terpisah, fixture khusus, tes memastikan tidak ada akses lintas tabel |
| Pemindaian mengganggu layanan hosting | Gangguan layanan | Nmap hanya localhost; sqlmap request rendah ke satu route aplikasi |
| Data uji tertinggal di deployment publik | Demo/privasi terganggu | Reset/redeploy terverifikasi; jangan menjalankan payload yang meninggalkan artefak tanpa cleanup |
| Runbook memberi instruksi stale | Demo gagal | Verifikasi setiap langkah dengan backend saat ini dan expected result |

## Pertanyaan terbuka
- Tidak ada untuk rencana lokal. Deploy publik tetap membutuhkan persetujuan eksplisit terpisah.
