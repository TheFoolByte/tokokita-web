# Implementation Plan: Backend TokoKita (lab rentan)

## Overview
Menambah server lokal untuk TokoKita supaya 5 celah bisa didemokan live:
SQLi bypass login, IDOR pesanan, harga checkout dari client, stored XSS
ulasan + pencurian cookie sesi, dan upload file + shell PHP simulasi.

## Architecture Decisions
- **Python stdlib** (`http.server` + `sqlite3`), satu file `server.py`. Tidak
  ada dependency baru, konsisten dengan cara jalan proyek (`python3 -m http.server`).
- **Bind 127.0.0.1** secara default + peringatan lab. Server ini sengaja rentan.
- **SQLi nyata** lewat konkatenasi string di query login; error SQL dikembalikan
  ke client supaya bisa dipakai demo error-based.
- **Sesi cookie** `PHPSESSID` tanpa `HttpOnly` (supaya bisa dicuri XSS) plus
  fallback cookie `user` yang dipercaya apa adanya (jalur cadangan demo).
- **Shell PHP simulasi**: file `.php` di `/uploads/` mengembalikan output
  palsu (`whoami`, `ls`, dst). Tidak ada `os.system`/`exec` sama sekali.
- **Data milik server**: users, orders, reviews, store name. Keranjang tetap
  di localStorage karena checkout justru mengirim harga dari client (celahnya).
- **Harga checkout dipercaya dari client** sesuai skenario demo.
- Frontend tetap ES5 dan memakai struktur/fungsi yang sudah ada; hanya isi
  fungsi yang diubah dari localStorage ke `fetch`.

## Task List

### Phase 1: Server + data
- [x] Task 1: `server.py` — SQLite schema, seed users/orders/reviews, static file serving.
- [x] Task 2: Auth API — login (SQLi), register, logout, `/api/me`, cookie sesi.

### Phase 2: Celah yang didemokan
- [x] Task 3: Ulasan server-side + render tanpa escape (stored XSS) + `/api/collect`.
- [x] Task 4: Checkout percaya harga client; IDOR `GET /api/orders/<id>`.
- [x] Task 5: Upload tanpa validasi + shell PHP simulasi di `/uploads/*.php`.

### Phase 3: Frontend + verifikasi
- [x] Task 6: `js/auth.js`, `js/app.js`, `js/data.js`, `pages/seller.html` disambung ke API.
- [x] Task 7: `tests/smoke_test.py` — cek SQLi, IDOR, harga, XSS tersimpan, cookie, shell.
- [x] Task 8: README cara jalan + langkah demo.

### Checkpoint
- [x] Smoke test lulus
- [x] Server jalan dan halaman utama terbuka

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Server rentan ini terekspos internet | Tinggi | Default bind 127.0.0.1, banner peringatan, README tegas |
| Shell upload jadi RCE nyata | Tinggi | Output shell 100% palsu, tidak pernah eksekusi perintah |
| Demo live gagal karena sesi hilang saat restart | Sedang | Cookie `user` fallback + login ulang cepat |
| Data demo kotor setelah latihan | Rendah | Hapus `tokokita.db`, server seed ulang otomatis |

## Open Questions
- Tidak ada; stack mengikuti proyek (Python stdlib, tanpa build step).
