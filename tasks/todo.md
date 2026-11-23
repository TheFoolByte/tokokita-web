# Todo — Backend TokoKita (lab rentan)

## Phase 1: Server + data
- [x] `server.py`: SQLite schema + seed + static serving
- [x] Auth API: login SQLi, register, logout, `/api/me`, cookie

## Checkpoint: server bisa login
- [x] `curl` login sukses dan cookie ter-set

## Phase 2: Celah demo
- [x] Ulasan server-side, render tanpa escape, `/api/collect`
- [x] Checkout harga client + IDOR `/api/orders/<id>`
- [x] Upload tanpa validasi + shell PHP simulasi

## Phase 3: Frontend + verifikasi
- [x] `js/auth.js` ke API
- [x] `js/app.js` (ulasan, checkout, pesanan, upload, seller) ke API
- [x] `js/data.js` buang seed yang pindah ke server
- [x] `pages/seller.html` tampilkan nama toko
- [x] `tests/smoke_test.py`
- [x] README

## Checkpoint: selesai
- [x] `python3 tests/smoke_test.py` lulus
- [x] `python3 server.py` + buka http://127.0.0.1:8000
