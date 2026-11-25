# Panduan Lengkap Demo Pentest TokoKita

> **Scope dan izin:** panduan ini hanya untuk aplikasi TokoKita milik tim dan presentasi berizin. Semua akun/record adalah data demo. Jangan gunakan langkah atau payload ini pada situs, akun, perangkat, jaringan, atau layanan pihak lain.
>
> **Target publik aplikasi:** `https://tokokita-web-production.up.railway.app` — hanya request HTTP(S) ke aplikasi. Jangan scan hostname/IP Railway, edge hosting, port lain, layanan metadata, atau sistem tetangga. **Nmap hanya ke `127.0.0.1` di laptop tim.**
>
> Aplikasi sengaja rentan. Jangan masukkan data pribadi/rahasia. Cookie hasil demo hanya milik akun dummy. Jangan jalankan sqlmap dengan `--dump`, `--all`, `--os-shell`, `--file-read`, `--file-write`, atau opsi destruktif.

## 1. Tujuan panduan

Gunakan tool sesuai kebutuhan, bukan sebanyak-banyaknya:

| Tool | Fungsi di demo | Target yang diperbolehkan |
|---|---|---|
| Burp Suite Community | Melihat, menangkap, mengubah, dan mengulang request HTTP aplikasi | Host TokoKita saja |
| sqlmap | Membuktikan SQLi pada katalog fixture sintetis | `/api/lab/search` saja; localhost saja, bukan situs publik |
| Nmap | Menunjukkan deteksi service pada server demo | `127.0.0.1:8000` saja |
| `curl` | Pemeriksaan request tunggal dan bukti cepat yang bisa diulang | Endpoint aplikasi yang tercantum |
| Browser DevTools | Melihat DOM/cookie demo, mengubah nilai form pada checkout | Browser presenter yang dikendalikan tim |

**Jangan gunakan Nmap ke domain/IP publik Railway.** Itu akan menguji edge/infrastruktur hosting bersama, bukan hanya aplikasi. Hindari pemindai otomatis lain pada situs publik. Untuk demonstrasi publik, pakai Burp manual dengan request sedikit dan jalur aplikasi yang tercantum di bawah.

## 2. Persiapan sebelum presentasi

### Akun dan URL

- Pemilik/admin demo: `kamila / kamila123`
- Akun pembeli demo: `rohandhika / rohandhika123`, `sari / sari123`, `jun / jun12345`, `budi / budi12345`, `maya / maya12345`, `dimas / dimas12345`, `nina / nina12345`, `raka / raka12345`, `lila / lila12345`, `fajar / fajar12345`, `dewi / dewi12345`.
- Total seed: **12 akun dummy** (1 admin, 11 pembeli). Gunakan hanya akun/credential lab ini; jangan pakai ulang password di layanan lain.
- Web publik: <https://tokokita-web-production.up.railway.app>
- Collector XSS: <https://tokokita-web-production.up.railway.app/collector>
- Endpoint sqlmap lokal: `/api/lab/search?category=electronics` — tersedia di source lokal terbaru. Deployment publik saat ini mungkin belum memiliki route ini.

**Jumlah temuan:** 6 kategori, 7 adegan: SQL injection (1 kategori, 2 adegan: bypass login dan fixture sqlmap), stored XSS, sesi lemah, manipulasi harga client-side, IDOR, dan upload tanpa validasi. Shell adalah simulasi dampak upload, bukan RCE sungguhan. Nmap hanya latihan reconnaissance lokal, bukan kerentanan aplikasi.

Sebelum demo lokal, cek route dengan `curl`. Jangan jalankan sqlmap pada publik; jika kelak endpoint lab di-deploy setelah persetujuan terpisah, tetap jalankan sqlmap hanya localhost.

### Siapkan tool

- **Burp:** buka Community Edition, buat Temporary Project, pilih konfigurasi default.
- **sqlmap:** di EndeavourOS pasang dari repositori resmi Arch:
  ```bash
  sudo pacman -S sqlmap
  sqlmap --version
  ```
- **Nmap:** pastikan tersedia (`nmap --version`). Jalankan hanya pada target localhost sesuai bagian 7.
- **curl:** tersedia di terminal Linux; cek `curl --version`.
- Siapkan dua terminal untuk uji lokal; jangan gunakan `sudo` untuk menjalankan aplikasi.

### Batas demo yang aman

- Uji publik hanya satu orang presenter, satu browser terkendali, satu request pada satu waktu.
- Jangan jalankan sqlmap publik. SQLi automation tetap lokal karena teknik blind bisa menghasilkan banyak request dan lama; untuk audiens, gunakan tangkapan layar/hasil uji lokal.
- Jangan unggah file pada web publik. Fitur upload publik menyimpan artefak dan reset API tidak membersihkannya.
- Demo collector memakai sesi admin dummy Kamila yang dikendalikan presenter dan payload harus mengecek `user=kamila`; jangan kumpulkan cookie akun pembeli/pengunjung lain.
- Hindari meninggalkan payload XSS di halaman yang akan dibuka pengunjung umum. Hapus ulasan payload dengan reset segera setelah adegan.
- Setelah percobaan yang menulis data, jalankan reset sesuai bagian 12.

## 3. Alur serangan dari basic ke deep

Ikuti urutan ini supaya cerita berkembang dari pengamatan sederhana, manipulasi input, ke dampak akun. Tool menjadi alat bantu di tiap babak—bukan urutan acara terpisah.

| Babak | Tingkat | Temuan | Tool utama | Dampak yang ditunjukkan |
|---|---|---|---|---|
| 0. Orientasi | Dasar | Pahami halaman, request, dan batas scope | Browser + Burp HTTP history | Kenali permukaan aplikasi tanpa scan agresif |
| 1. Kepercayaan pada client | Dasar | Harga checkout bisa diubah | DevTools / Burp Repeater | Total order demo menjadi Rp100 |
| 2. Otorisasi object | Menengah | IDOR order | Browser / Burp Repeater | Akses order fixture akun demo lain |
| 3. Injection autentikasi | Menengah | SQLi login bypass | Burp Repeater | Login demo sebagai admin tanpa password |
| 4. Injection terukur | Lanjutan | SQLi fixture katalog | sqlmap lokal + curl | Deteksi SQLite; tampilkan hanya fixture dummy |
| 5. Eksekusi konten | Lanjutan | Stored XSS + cookie dapat dibaca JS | Browser DevTools / collector | JavaScript berjalan pada origin demo terkendali |
| 6. Dampak upload | Finale opsional | Upload tanpa validasi; shell simulasi | Browser lokal | Tunjukkan risiko upload, jelaskan bukan RCE |
| Recon pendukung | Konteks | Port lokal server demo | Nmap localhost sebelum acara | Identifikasi port 8000 tanpa scan hosting |

### Narasi transisi

1. **Orientasi:** “Kita mulai dari traffic normal. Client dan server bertukar request; sekarang kita lihat apa yang dipercaya server.”
2. **Harga:** “Kalau browser mengirim harga, apakah server menghitung ulang?” Tunjukkan harga Rp100.
3. **IDOR:** “Selain nilai uang, apakah server membatasi data tiap akun?” Tunjukkan order fixture #201.
4. **SQLi login:** “Bagaimana jika input mengubah query autentikasi?” Bypass akun demo lewat Repeater.
5. **sqlmap:** “Tool otomatis bisa membuktikan injection secara sistematis; hasilnya dibatasi ke fixture lokal.” Tampilkan screenshot pre-run, curl langsung.
6. **XSS:** “Jika konten tersimpan dirender sebagai HTML, script berjalan di browser pemilik.” Gunakan browser presenter saja.
7. **Upload/finale:** “Upload tanpa validasi berisiko; pada lab ini shell hanya simulasi.” Jangan unggah ke publik.
8. **Penutup:** simpulkan mitigasi dan reset.

**Jangan memulai presentasi dengan menjalankan sqlmap/Nmap.** Nmap lokal selesai sebelum acara; sqlmap lokal dijalankan sebelumnya dan hasilnya disiapkan. Urutan cerita saat presentasi: orientasi → dampak sederhana → kontrol akses → injection → XSS/upload → mitigasi.

## 4. Alur Burp Suite Community

### 3.1 Buka browser Burp dan tangkap request

1. Buka Burp → **Proxy → Intercept**.
2. Pilih **Open browser** agar Firefox bawaan Burp otomatis memakai proxy Burp.
3. Buka URL TokoKita di browser itu. Halaman dan file JS/CSS akan muncul di **Proxy → HTTP history**; **Target → Site map** terisi setelah ada traffic.
4. Kalau Site map kosong, belum ada request dari browser melalui proxy. Buka/reload halaman dari browser Burp.
5. Matikan **Intercept is on** saat menjelajah normal; traffic tetap tercatat di HTTP history.
6. Filter host ke `tokokita-web-production.up.railway.app` supaya request demo mudah dibaca.

Aplikasi publik memakai HTTPS. Gunakan browser Burp bawaan yang sudah disiapkan. Jika browser menunjukkan peringatan sertifikat, hanya pasang Burp CA ke **profil browser khusus testing** mengikuti dokumentasi resmi PortSwigger; jangan pasang ke trust store global OS, jangan abaikan warning dengan mengirim data sensitif.

### 3.2 SQLi bypass login (Burp manual)

**Tujuan:** tunjukkan login menerima input yang mengubah logika query. Ini endpoint login utama, jangan jalankan sqlmap di endpoint ini.

1. Di browser Burp buka halaman login TokoKita.
2. Isi username:
   ```text
   ' OR '1'='1
   ```
   Isi password apa saja, misalnya `demo`, lalu tekan Masuk.
3. Di Burp **Proxy → HTTP history**, cari `POST /api/login`, klik kanan → **Send to Repeater**.
4. Pada tab **Repeater**, periksa request: `Content-Type: application/json` dan body berisi `identifier` serta `password`.
5. Klik **Send**. Amati response JSON: akun hasil bypass memiliki `role: admin`.
6. Tunjukkan bahwa ini bukan password cracking: input mengubah kondisi SQL karena query menyambung string input.

**Catatan:** bentuk request bisa berbeda bila frontend berubah. Ambil request aktual dari HTTP history, jangan menebak body.

### 3.3 Checkout: ubah harga di request

**Tujuan:** tunjukkan backend percaya harga yang dikirim client. Request ini membuat order demo baru, jadi reset sesudahnya.

1. Gunakan browser Burp dan masukkan produk laptop demo ke keranjang.
2. Buka checkout. Di Burp HTTP history cari `POST /api/checkout`.
3. Klik kanan → **Send to Repeater**.
4. Di body JSON ubah nilai `price` item laptop menjadi `100`; jangan ubah endpoint/parameter lain.
5. Klik **Send** satu kali.
6. Periksa response: total menjadi `100` dan ada nomor order baru.
7. Narasi: harga harus dihitung ulang dari database di server, bukan dipercaya dari browser.

Jangan mengirim berkali-kali; tiap request dapat membuat order baru.

### 3.4 IDOR: akses record pesanan demo lain

**Tujuan:** menunjukkan server tidak memeriksa kepemilikan object.

1. Gunakan sesi pembeli demo (`rohandhika`) atau tanpa login.
2. Kirim request:
   ```http
   GET /api/orders/201 HTTP/1.1
   Host: tokokita-web-production.up.railway.app
   ```
   Cara mudah: buka URL ini di browser Burp:
   `https://tokokita-web-production.up.railway.app/api/orders/201`
3. Response `200` berisi order milik Kamila, termasuk data alamat/nomor demo.
4. Batasi demonstrasi ke ID fixture `201`, `202`, atau `203`. Jangan enumerasi ID lain.
5. Narasi: autentikasi saja tidak cukup; setiap object harus dicek izin pemiliknya.

### 3.5 Menjelaskan request, response, dan scope

- **Request** menunjukkan apa yang dapat dikendalikan client: method, path, header, cookie, body.
- **Response** menunjukkan hasil server: status, JSON, `Set-Cookie`/header.
- **Repeater** mengulang satu request agar perubahan satu parameter mudah dibandingkan.
- Hindari Intruder/fuzzing otomatis pada layanan publik; tidak dibutuhkan untuk skenario ini.

## 5. sqlmap: latihan terisolasi lokal

Endpoint ini sengaja rentan, tapi menyimpan fixture dalam file SQLite terpisah `tokokita-lab.db`. Isinya hanya empat produk dummy; endpoint hanya query read-only dengan hasil maksimum 10 baris. Batas panjang parameter 4096 karakter agar payload deteksi sqlmap dapat lewat. Pengujian lokal dapat memakan waktu karena deteksi boolean-based mengirim banyak request.

**Jangan menjalankan sqlmap pada URL publik.** Jangan arahkan ke `/api/login`, `/api/orders`, atau endpoint lain. Jangan gunakan ekstraksi blind, `--dump`, `--all`, `--os-shell`, `--file-read`, `--file-write`, `--forms`, crawl, tamper, level/risk tinggi, atau banyak thread.

### 4.1 Jalankan server terisolasi

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

Expected: dua produk, `Demo Laptop A` dan `Demo Mouse B`. Untuk melihat seluruh empat fixture dalam satu request tanpa sqlmap:

```bash
curl --get --data-urlencode "category=electronics' OR '1'='1' -- " \
  'http://127.0.0.1:8000/api/lab/search'
```

Expected: tepat empat produk demo. Ini cara tercepat menunjukkan dampak ke audiens.

### 4.2 Jalankan deteksi sqlmap

Gunakan boolean/error-based saja. Jangan tambahkan teknik `T` (time-based), yang dapat membuat setiap nilai diekstrak satu per satu selama beberapa menit.

```bash
sqlmap -u 'http://127.0.0.1:8000/api/lab/search?category=electronics' \
  -p category --batch --flush-session --level=1 --risk=1 \
  --technique=BEU --timeout=5 --retries=0
```

- `-u`: URL route lab lokal.
- `-p category`: batasi pengujian ke parameter yang disengaja rentan.
- `--batch`: gunakan jawaban default agar tidak berhenti pada prompt.
- `--flush-session`: buang cache hasil sebelumnya untuk target tersebut.
- `--level=1 --risk=1`: nilai minimum.
- `--technique=BEU`: boolean, error, dan UNION. Jika sqlmap bertanya apakah ingin lanjut uji UNION setelah menemukan boolean injection, jawab **N**; demo cukup dengan temuan pertama.
- `--timeout=5 --retries=0`: jangan menunggu lama atau mengulang request berkali-kali.

**Perkiraan waktu:** bisa beberapa menit karena jumlah request deteksi. Untuk demo langsung, jalankan perintah sebelum presentasi dan siapkan screenshot; gunakan `curl` untuk bukti live instan. Hentikan dengan `Ctrl+C` bila terlalu lama; tidak ada keharusan menunggu.

Expected: sqlmap mengidentifikasi `category` sebagai injectable dan backend sebagai SQLite. Pada verifikasi lokal, deteksi boolean/UNION selesai dengan 46 request dalam sekitar satu detik. Tidak perlu menjalankan query dump/extract. Bukti hasil fixture ditunjukkan dengan `curl` di atas.

Sqlmap dapat mencatat beberapa response `400` saat mencoba payload sintaks yang tidak cocok; selama tetap menemukan parameter injectable, ini tidak berarti endpoint mati. Jangan menaikkan intensitas untuk menghilangkan semua 400.

### 4.3 Kalau muncul banyak HTTP 400

- Pastikan server lokal menjalankan commit yang memiliki route `/api/lab/search` dan batas parameter 4096 karakter.
- Pastikan terminal 1 tidak menunjukkan error server.
- Jalankan `python3 tests/smoke_test.py` dari repo untuk verifikasi endpoint terisolasi.
- Jangan naikkan batas/risk atau pindah ke URL publik untuk mengatasi error.

### 4.4 Menghentikan dan membersihkan uji lokal

Tekan `Ctrl+C` pada sqlmap jika masih berjalan. Untuk mematikan server lokal, tekan `Ctrl+C` di terminal 1. DB lab lokal hanya berisi fixture sintetis. Jangan pernah mengarahkan sqlmap ke DB utama toko.

## 6. Nmap: pemetaan port localhost

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

- `-sV`: coba identifikasi service/version pada port yang dipilih.
- `-p 8000`: batasi ke port server lokal demo.
- `127.0.0.1`: target loopback di laptop sendiri.

Expected: hanya `8000/tcp` yang dilaporkan untuk target localhost. Server menampilkan banner demo yang meniru Apache/PHP; banner itu bukan bukti stack aslinya. Jangan ganti target menjadi domain/IP Railway, jangan scan subnet, semua port, atau opsi agresif.

## 7. Checkout price tampering: Browser DevTools

Burp Repeater adalah cara yang lebih visual; Console juga dapat menunjukkan perubahan DOM pada browser presenter.

1. Buka checkout dengan produk laptop di browser presenter.
2. Buka DevTools → **Console**.
3. Jalankan:
   ```js
   document.getElementById('priceField1').value = 100
   ```
4. Klik tombol bayar sekali; UI menunjukkan total Rp100.
5. Untuk pembuktian jaringan, buka Network tab dan lihat body `POST /api/checkout`.

Jangan lakukan berkali-kali; reset data setelah selesai. Kalau ID field berubah, gunakan Burp Repeater dan ubah field `price` pada request aktual.

## 8. Stored XSS dan cookie sesi demo

**Peringatan:** ulasan tersimpan dan dieksekusi saat halaman produk dibuka. Jalankan hanya di lingkungan/browser demo yang dikendalikan tim. Jangan submit payload di situs publik sebelum presentasi, karena pengunjung lain bisa ikut memicu payload.

### Payload yang hanya memunculkan bukti visual

Pilihan paling aman untuk latihan lokal adalah payload alert:

```html
<img src=x onerror="alert('Stored XSS demo')">
```

1. Login dengan akun demo pada browser lokal yang dikendalikan tim.
2. Buka halaman produk, kirim payload sebagai review.
3. Reload halaman produk. Dialog alert menunjukkan stored payload dieksekusi saat render.
4. Reset database lokal sesudahnya.

### Collector cookie pada deployment presentasi terkendali

Gunakan hanya jika kedua browser dan akun dikendalikan presenter, Kamila menyetujui adegan, dan risiko stored payload dipahami. Collector hanya menerima pasangan cookie tepat `user=kamila` dan panjang maksimal 1024 karakter; cookie user lain ditolak. Payload memeriksa cookie sebelum mengirim ke collector TokoKita sendiri:

```html
<img src=x onerror="if(document.cookie.includes('user=kamila'))fetch('/api/collect?c='+encodeURIComponent(document.cookie))">
```

1. Pakai akun dummy `kamila` dalam browser demo terkendali.
2. Submit review pada halaman produk demo.
3. Buka halaman produk itu pada browser pemilik; payload berjalan.
4. Buka `/collector` di aplikasi untuk menunjukkan cookie demo tertangkap.
5. Jangan salin cookie ke host lain, jangan gunakan sesi/akun pribadi, dan segera reset ulasan.

`PHPSESSID` sengaja tidak memakai `HttpOnly` demi skenario ini. Collector membatasi data pada cookie `user=kamila` dan panjang maksimal 1024 karakter. Jangan merekam atau mempublikasikan token sesi aktif; bersihkan collector setelah presentasi.

## 9. Upload file: demonstrasi simulasi lokal saja

Upload menerima nama/ekstensi tanpa validasi, tetapi shell PHP **tidak dieksekusi**. Fitur shell hanya mengembalikan output hard-coded; tidak menjalankan command OS.

1. Jalankan TokoKita lokal.
2. Login akun demo, buka Profil → unggah file dummy bernama `shell.php` (isi teks biasa; tidak perlu memasukkan kode PHP).
3. Buka URL yang ditampilkan, atau:
   ```text
   http://127.0.0.1:8000/uploads/shell.php?cmd=whoami
   ```
4. Halaman menampilkan output simulasi `www-data`.
5. Jangan unggah ke deployment publik. Upload publik bisa meninggalkan artefak dan reset API tidak menghapusnya.

Jangan klaim ini sebagai RCE sungguhan. Tidak ada eksekusi perintah.

## 10. Urutan presentasi yang disarankan (12 menit)

1. **0:00–1:00 — Izin dan scope.** Kamila pemilik; Jun penguji berizin; semua akun dan data dummy.
2. **1:00–2:00 — Peta aplikasi.** Tunjukkan halaman login, katalog, checkout, review, order.
3. **2:00–3:00 — Checkout harga Rp100.** Ubah harga di client; total order demo menjadi Rp100.
4. **3:00–4:00 — IDOR order #201.** Akses order fixture akun demo lain.
5. **4:00–6:00 — SQLi login.** Burp Repeater bypass login; jelaskan query memercayai input.
6. **6:00–7:00 — sqlmap lokal.** Tampilkan hasil yang sudah disiapkan/screenshot; `curl` memperlihatkan empat fixture dalam satu request.
7. **7:00–9:00 — Stored XSS + collector.** Browser presenter saja; tunjukkan alert atau collector, jangan tampilkan token mentah.
8. **9:00–10:00 — Upload simulasi.** Opsional, lokal saja; tekankan bukan RCE.
9. **10:00–12:00 — Mitigasi, reset, Q&A.** Sampaikan batas yang diuji dan apa yang tidak diuji.

Nmap dapat dijalankan sebelum presentasi di laptop lokal dan hasilnya ditampilkan singkat sebagai konteks port—bukan sebagai pemindaian terhadap hosting.

## 11. Ringkasan temuan dan mitigasi

| ID | Kerentanan | Bukti yang aman untuk demo | Dampak contoh | Mitigasi produksi |
|---|---|---|---|---|
| F-01 | SQLi login | Burp Repeater pada `POST /api/login`, akun admin demo kembali | Bypass autentikasi demo | Prepared statements, validasi, pesan error generik, DB least-privilege |
| F-02 | SQLi fixture terisolasi | sqlmap lokal pada `/api/lab/search`, `category` terdeteksi | Hanya empat produk dummy terbaca | Parameterized query; route ini hanya untuk lab |
| F-03 | Stored XSS | Alert lokal atau collector pada browser presenter | JavaScript berjalan pada origin demo | Output encoding, sanitasi allowlist, CSP |
| F-04 | Cookie sesi tanpa HttpOnly | Collector menerima cookie akun dummy Kamila saja | Sesi admin demo dapat diperagakan | Cookie `HttpOnly`/`Secure`/`SameSite`, rotasi sesi |
| F-05 | Harga dari client | Repeater ubah price ke 100, response total 100 | Order demo salah harga | Hitung harga/total server-side dari katalog terpercaya |
| F-06 | IDOR pesanan | GET order fixture #201 tanpa pengecekan owner | Data order demo lain terlihat | Otorisasi object-level setiap request dan field minimization |
| F-07 | Upload tanpa validasi | Upload dummy lokal, file diterima | Risiko file tak aman tersaji | Allowlist tipe/ukuran, verifikasi konten, simpan di luar webroot, nonaktifkan eksekusi |
| — | Shell upload simulasi | URL `?cmd=whoami` menampilkan fixture hard-coded | Ilustrasi dampak F-07 saja; bukan RCE | Jangan eksekusi upload; isolasi storage/proses |
| — | Nmap lokal | `nmap -sV -p 8000 127.0.0.1` | Port lokal teridentifikasi; bukan kerentanan | Minimalkan port dan banner pada server nyata |

Akun pembeli dummy: `rohandhika`, `sari`, `jun`, `budi`, `maya`, `dimas`, `nina`, `raka`, `lila`, `fajar`, `dewi`. Seluruhnya memakai data dan kredensial sintetis yang didokumentasikan pada bagian 2. Gunakan variasi akun ini hanya untuk latihan kontrol akses dalam fixture demo.

## 12. Reset data

### Reset data toko aplikasi

`POST /api/seller/reset` memulihkan ulasan seed, menghapus order checkout ber-ID >=301, menghapus override harga, dan mengembalikan nama toko. Endpoint memerlukan sesi admin. Dari browser pemilik demo:

```js
fetch('/api/seller/reset', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

Lalu verifikasi:

```text
GET /api/prices  → {"prices": {}}
GET /api/reviews?pid=1 → ulasan seed saja
```

**Reset API tidak menghapus file upload dan tidak menghapus database lab.** Jangan upload pada publik. Pada lokal, untuk reset total hentikan server dan hapus DB serta upload:

```bash
rm -f tokokita.db tokokita-lab.db
find uploads -mindepth 1 -maxdepth 1 -type f -delete
```

Jalankan server lagi; DB seed dibuat ulang. Jangan jalankan perintah hapus di luar direktori project lokal.

## 13. Fallback saat demo

- **Site map kosong:** buka/reload app dari browser Burp bawaan; cek Proxy → HTTP history.
- **Burp menahan halaman:** matikan Intercept; request tetap terekam.
- **sqlmap lama:** hentikan dengan `Ctrl+C`, tampilkan hasil lokal yang sudah direkam, lalu gunakan curl untuk response fixture. Jangan aktifkan `T` atau menaikkan intensitas.
- **Endpoint lab publik 404:** fitur belum ter-deploy atau deployment belum selesai; jangan menguji host lain. Pakai server lokal atau screenshot.
- **XSS tidak muncul:** pastikan review dikirim ke product ID yang sama dan halaman produk direload; jika tetap gagal, gunakan payload alert lokal.
- **Request checkout membuat order baru:** reset data setelah demo.
- **Upload publik tertinggal:** reset API tidak cukup. Hentikan penggunaan fitur; redeploy hanya dengan persetujuan pemilik.
- Jika satu percobaan ulang gagal, pindah ke screenshot/rekaman dan jelaskan penyebab serta mitigasi. Jangan improvisasi dengan target tambahan.
