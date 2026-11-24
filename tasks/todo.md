# Todo — Demo Pentest Publik TokoKita

## Fase 1: Data dan endpoint lab
- [x] Tugas 1 — tambah 12 akun demo sintetis secara idempotent; akun utama tetap ada.
  - Verifikasi: smoke test memastikan 12 username tersedia.
- [x] Tugas 2 — collector XSS hanya menerima cookie akun admin demo Kamila (maksimum 1024 karakter).
  - Verifikasi: smoke test menolak cookie pembeli dan input terlalu panjang.
- [x] Tugas 3 — kontrak endpoint + fixture sintetis sqlmap.
  - Kriteria: endpoint/parameter/kolom hasil terdokumentasi; fixture terpisah dari data toko.
  - Verifikasi: tinjau kontrak terhadap batas di `SPEC-public-pentest-demo.md`.
- [x] Tugas 4 — endpoint SQLi read-only dengan batas ukuran, waktu, dan hasil.
  - Kriteria: injection terdeteksi; hanya data fixture yang dapat terbaca; tidak ada fungsi tulis.
  - Verifikasi: py_compile + tes endpoint lokal.
  - Bergantung pada: Tugas 1.
- [x] Tugas 5 — tes isolasi dan input.
  - Kriteria: uji input valid, invalid, oversized; data tabel lain tetap identik.
  - Verifikasi: `python3 tests/smoke_test.py`.
  - Bergantung pada: Tugas 4.

## Checkpoint lab lokal
- [x] Smoke test dan tes isolasi lulus.
- [x] sqlmap mendeteksi SQLi di localhost; curl menunjukkan fixture sintetis.

## Fase 2: Panduan demo
- [x] Tugas 6 — buat `docs/demo-runbook.md` (Burp, sqlmap, Nmap lokal, mitigasi, reset, fallback).
  - Kriteria: seluruh langkah dapat direproduksi, Bahasa Indonesia, expected result jelas, scope aman.
  - Verifikasi: audit command dan route terhadap implementasi.
  - Bergantung pada: Tugas 3.
- [x] Tugas 7 — selaraskan README dan catatan dokumentasi lama.
  - Kriteria: README tidak lagi mengarahkan penggunaan publik ke lokal saja secara kontradiktif; tautan runbook tersedia.
  - Verifikasi: grep klaim URL/host dan uji semua link lokal.
  - Bergantung pada: Tugas 4.

## Checkpoint dokumentasi
- [x] Runbook tidak menargetkan Railway/infra hosting.
- [x] Tidak ada dump data akun/order; langkah bersih-bersih jelas.
- [x] Alur presentasi disusun dari basic ke deep.

## Fase 3: Verifikasi / rilis
- [ ] Tugas 6 — tes lengkap, review diff, reset state lokal.
  - Verifikasi: `python3 tests/smoke_test.py`, `python3 -m py_compile server.py`, review manual.
- [ ] Tugas 7 — deploy publik hanya setelah persetujuan baru.
  - Kriteria: versi dan data fixture terverifikasi; state demo bersih.
  - Verifikasi: pemeriksaan HTTPS yang dibatasi pada domain aplikasi.
  - Bergantung pada: Tugas 6 + persetujuan eksplisit.

## Checkpoint selesai
- [ ] Semua kriteria spec tercapai.
- [ ] Tidak ada deployment tanpa izin terpisah.
