# TokoKita — Lab Web Rawan (demo serangan)

> **PERINGATAN.** Aplikasi ini **sengaja dibuat rentan** untuk demo/latihan berizin.
> Jangan pakai data asli atau password yang digunakan di tempat lain. Instalasi lokal
> default hanya bind ke `127.0.0.1`; deployment publik demo hanya untuk aplikasi
> TokoKita dan tetap tidak boleh dipakai menyerang infrastruktur hosting/pihak lain.
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
- Demo dua laptop di jaringan privat milik tim saja: `python3 server.py --host 0.0.0.0`, lalu akses `http://<IP-laptop-kamu>:8000`. Jangan expose port ini ke jaringan publik.
- Reset data demo lokal: hentikan server, hapus `tokokita.db`, `tokokita-lab.db` dan isi `uploads/`, lalu jalankan ulang.
- Cek cepat semua celah: `python3 tests/smoke_test.py`
- Panduan teknis presenter/penguji: [`docs/demo-runbook.md`](docs/demo-runbook.md)
- Panduan non-teknis untuk Kamila: [`docs/panduan-kamila.md`](docs/panduan-kamila.md)

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
├── tokokita.db      # SQLite akun/pesanan/review
└── tokokita-lab.db  # SQLite terpisah, empat fixture sqlmap
```

Kedua database dibuat otomatis saat server pertama dijalankan.

## Cakupan temuan

Ada **6 kategori kelemahan aplikasi**: SQL injection, stored XSS, kelemahan perlindungan sesi, manipulasi harga client-side, IDOR pesanan, dan upload tanpa validasi. SQLi memiliki dua skenario (login dan fixture sqlmap). Shell upload adalah simulasi dampak, bukan RCE. Nmap hanya recon server lokal, bukan kerentanan aplikasi.

Semua pengujian publik harus dibatasi ke aplikasi TokoKita. Jangan scan Railway/hosting, jaringan, metadata service, atau target pihak lain. Untuk sqlmap gunakan endpoint fixture di localhost saja.

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

### 2. Stored XSS + sesi demo yang lemah

Review disimpan lalu dirender sebagai HTML tanpa escape; cookie `PHPSESSID`
sengaja tidak memakai `HttpOnly`. Payload dapat berjalan di browser yang membuka
review tersebut. Untuk latihan lokal, gunakan payload visual:

```html
<img src=x onerror="alert('Stored XSS demo')">
```

Collector demo hanya menerima cookie yang mengandung pasangan tepat `user=kamila`
dan maksimal 1024 karakter. Alur collector dua-browser hanya untuk sesi admin
Kamila yang dikendalikan presenter dan dengan persetujuannya. Jangan kumpulkan
cookie pembeli/pengunjung, jangan tempel token ke sistem lain, dan segera reset
review setelah adegan.

```html
<img src=x onerror="if(document.cookie.includes('user=kamila'))fetch('/api/collect?c='+encodeURIComponent(document.cookie))">
```

Cookie `user` juga dipercaya sebagai fallback identitas; itu kelemahan sesi
terpisah. Jangan gunakan jalur bypass tersebut untuk sesi atau akun di luar
fixture demo. Detail alur dan batasnya: [`docs/demo-runbook.md`](docs/demo-runbook.md).

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

Di halaman Profil, unggah file teks dummy bernama `shell.php` (tidak perlu isi
kode PHP). Server tidak memvalidasi ekstensi. Handler hanya menampilkan output
hard-coded; tidak ada perintah yang dieksekusi. Gunakan lokal saja karena upload
publik meninggalkan artefak sampai container/file dibersihkan. Buka:

```
http://127.0.0.1:8000/uploads/shell.php?cmd=whoami
```

Muncul tampilan shell dengan output palsu (`www-data`, `ls`, `cat .env`, dst.).
Semua output di-hardcode di `SHELL_OUTPUTS` pada `server.py`; tidak ada
`os.system`/`exec`.

### 6. SQL injection — katalog fixture khusus sqlmap

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
| POST | `/api/reviews` | simpan ulasan mentah (stored XSS demo) |
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
| GET | `/api/collect?c=...` | collector cookie; hanya menerima `user=kamila`, maks. 1024 karakter |
| GET | `/collector` | halaman bukti collector demo |

Sesi disimpan di memori: restart server = login ulang. Akun/pesanan/ulasan dan harga toko disimpan di `tokokita.db`; empat produk sqlmap ada di `tokokita-lab.db`. Upload berada di `uploads/`. Reset API tidak menghapus upload, data collector in-memory, atau database lab.
