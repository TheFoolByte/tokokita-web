# Runbook TokoKita — Panduan Demo untuk Kamila

> **Versi terkoreksi.** Dokumen ini adalah panduan panggung untuk presentasi TokoKita. Di repo, file ini menggantikan panduan lama di `docs/runbook.md`.

| Angka resmi demo | Keterangan |
| --- | --- |
| **6 kategori** | SQL Injection, Stored XSS, Sesi Lemah, Harga dari Client, IDOR, Upload |
| **7 adegan** | SQL Injection tampil dua kali: login dan lab sqlmap |
| **12 menit** | Durasi rundown resmi, dari pembuka sampai reset |

> [!WARNING]
> **Satu angka, satu urutan.** Kalau ada dokumen lain yang menyebut jumlah atau urutan berbeda, yang berlaku adalah dokumen ini: **6 kategori, 7 adegan**, dengan rundown **harga → IDOR → SQLi login → sqlmap → XSS → upload → mitigasi dan reset**.

---

## Baca ini sebelum demo

Dokumen ini ditujukan untuk Kamila sebagai pemeran pemilik toko. Kamu tidak perlu punya latar belakang keamanan siber. Tujuannya agar kamu tahu apa yang sedang ditampilkan, apa dampaknya, bagian mana yang simulasi, dan kapan harus menghentikan adegan.

**TokoKita adalah aplikasi latihan yang sengaja dibuat rentan.** Pengujian hanya boleh menyasar aplikasi TokoKita yang menjadi target demo.

- Jangan menguji Railway, server atau edge hosting, jaringan kampus, akun, atau sistem pihak lain.
- Jangan gunakan data pribadi, password asli, atau akun yang dipakai di layanan lain.
- Jangan menarasikan demo ini sebagai “membobol Railway”. Ceritanya adalah menemukan kesalahan pada logika aplikasi TokoKita.

Aplikasi ini publik selama masa demo. Celah stored XSS dapat berjalan di browser siapa pun yang membuka ulasan berbahaya sebelum dibersihkan. Karena itu, jalankan presentasi dalam jendela waktu yang disepakati, gunakan akun dan browser demo, lalu segera reset data setelah adegan. Pemilik proyek bertanggung jawab mematikan deployment setelah presentasi.

---

## 1. Cerita yang akan dibawakan

- **Kamila** berperan sebagai pemilik TokoKita yang mengira alur toko berjalan normal.
- **Jun** berperan sebagai penguji yang mendapat izin dari pemilik.
- Audiens melihat dua laptop atau proyektor: Kamila menunjukkan sisi pemilik; Jun menunjukkan bagaimana request aplikasi dapat diuji.
- Semua username, password, pesanan, dan produk pada seed adalah data dummy.

Kalimat pembuka yang bisa digunakan:

> “Saya Kamila, pemilik TokoKita. Jun menguji aplikasi demo ini dengan izin saya. Semua akun dan data dibuat khusus untuk latihan. Pengujian hanya mencakup aplikasi TokoKita, bukan layanan hosting atau sistem lain.”

---

## 2. Istilah dasar tanpa jargon

| Istilah | Penjelasan sederhana |
| --- | --- |
| Browser / client | Aplikasi di laptop pengguna. Ia mengirim halaman, formulir, harga, dan request ke server. |
| Server | Program yang menerima request dan menentukan jawaban. Keputusan penting seharusnya dilakukan di sini. |
| Request | Pesan yang dikirim browser ke server, misalnya “login” atau “buat pesanan”. |
| Response | Jawaban server, misalnya halaman, status `200`, atau data JSON. |
| Database | Tempat server menyimpan akun, pesanan, ulasan, dan pengaturan. |
| Cookie | Nilai kecil yang browser kirim kembali ke situs untuk mengenali sesi login. Perlakukan token sesi seperti kunci sementara. |
| Payload | Input uji yang sengaja dibuat untuk menunjukkan apakah aplikasi menangani masukan dengan aman. |
| Endpoint / route | Alamat tertentu di aplikasi yang melakukan satu pekerjaan, misalnya `/api/login`. |
| Fixture | Data contoh yang disiapkan khusus untuk latihan, bukan data pengguna sungguhan. |
| Reset | Memulihkan sebagian data toko ke kondisi seed awal. Tidak semua reset menghapus file upload. |

Kode status yang mungkin terlihat di Burp atau log:

| Kode | Arti |
| ---: | --- |
| `200` | Request diproses berhasil. |
| `304` | Browser memakai aset yang sudah di-cache; bukan kegagalan. |
| `400` | Request atau payload tidak cocok, atau input ditolak. |
| `401` | Belum terautentikasi atau kredensial salah. |
| `403` | Identitas tidak punya izin. |
| `404` | Route atau record tidak ditemukan, atau sengaja disembunyikan. |
| `500` | Server gagal memproses request; pada demo login, ini bisa muncul bersama detail error SQL — lihat Temuan Audit Tambahan. |

Bar merah pada Railway logs tidak otomatis berarti error; lihat status HTTP dan isi pesannya.

---

## 3. TokoKita dari hulu ke hilir

```text
Pengguna
  → membuka halaman HTML toko
  → browser memuat CSS, JavaScript, dan gambar produk
  → JavaScript mengirim request ke API Python di server
  → server membaca / menulis database SQLite
  → browser menampilkan response JSON sebagai halaman toko
```

Bagian utama proyek:

| Bagian | Isi |
| --- | --- |
| `index.html`, `pages/`, `css/`, `assets/` | Halaman dan tampilan toko |
| `js/auth.js` | Login, register, logout, dan pemulihan sesi browser |
| `js/app.js` | Katalog, review, checkout, pesanan, upload, dan dashboard penjual |
| `server.py` | API, sesi, database, static files, serta skenario rentan |
| `tokokita.db` | Data utama aplikasi |
| `tokokita-lab.db` | Database terpisah berisi empat produk dummy untuk latihan sqlmap |
| `tests/smoke_test.py` | Tes otomatis bahwa perilaku demo tetap sesuai skenario |

Di Railway, server aplikasi menerima request melalui HTTPS publik. Railway adalah penyedia hosting, tetapi **infrastruktur Railway bukan bagian dari target**. Jangan melakukan pemindaian jaringan atau port terhadap Railway.

### Data dan akun demo

Ada 12 akun seed sintetis:

| Peran | Username / password |
| --- | --- |
| Admin / pemilik | `kamila / kamila123` |
| Pembeli | `rohandhika / rohandhika123` |
| Pembeli | `sari / sari123` |
| Pembeli | `jun / jun12345` |
| Pembeli | `budi / budi12345`, `maya / maya12345`, `dimas / dimas12345` |
| Pembeli | `nina / nina12345`, `raka / raka12345`, `lila / lila12345` |
| Pembeli | `fajar / fajar12345`, `dewi / dewi12345` |

Pesanan seed yang memang ada saat ini: `#101` dan `#102` milik Rohandhika, `#201` milik Kamila, serta `#202` dan `#203` milik Sari. Akun tambahan tidak otomatis memiliki pesanan masing-masing.

Password tersebut hanya untuk lab. Jangan gunakan di email, akun pribadi, atau layanan lain.

---

## 4. Enam kategori, tujuh adegan

Hitungan yang paling jujur untuk presentasi: **6 kategori kelemahan aplikasi, ditampilkan dalam 7 adegan demo**. SQL Injection adalah satu kategori yang ditampilkan lewat dua adegan berbeda. Kelemahan sesi adalah kategori tersendiri — bukan bagian dari XSS.

| Kategori | Nama | Lokasi utama | Yang ditunjukkan |
| ---: | --- | --- | --- |
| 1 | SQL Injection | `POST /api/login` dan lab sqlmap | Input mengubah query; tool otomatis memastikannya di lab terpisah |
| 2 | Stored XSS | `POST /api/reviews` | HTML berbahaya disimpan dan dijalankan saat review dibuka |
| 3 | Harga dipercaya dari browser | `POST /api/checkout` | Harga item diubah menjadi Rp100 sebelum server menghitung total |
| 4 | Sesi lemah | Cookie `PHPSESSID` dan cookie `user` | Cookie sesi bisa dibaca JavaScript; cookie `user` dipercaya sebagai identitas |
| 5 | IDOR | `GET /api/orders/<id>` | ID pesanan diganti untuk membaca pesanan akun demo lain |
| 6 | Upload tanpa validasi memadai | `POST /api/upload` | File diterima tanpa validasi memadai; shell di URL upload hanyalah simulasi |

Nmap bukan kerentanan aplikasi; itu hanya alat pengamatan server lokal.

### Bukan kerentanan sungguhan di lab

- `nmap -sV -p 8000 127.0.0.1` hanya mengenali port server demo yang berjalan di laptop sendiri. Jangan arahkan ke Railway.
- URL `/uploads/shell.php?cmd=whoami` menampilkan teks output yang sudah ditulis di kode (daftar `SHELL_OUTPUTS`). Tidak ada perintah sistem yang dijalankan, jadi ini bukan remote code execution (RCE).
- Header yang menyebut Apache/PHP adalah banner simulasi; backend sebenarnya Python stdlib.
- `tokokita-lab.db` hanya berisi empat produk latihan, dibuka read-only, dan hasil pencariannya dibatasi maksimal sepuluh baris. Tidak ada akun atau pesanan di dalamnya.

---

## 5. Penjelasan tiap kategori dan peran Kamila

### Kategori 1 — SQL Injection: login dan lab sqlmap

**Apa artinya?** Aplikasi menyimpan data dengan SQL. Jika program menempelkan teks dari formulir langsung ke query, masukan tertentu dapat mengubah arti query tersebut — seperti pengguna mengubah pertanyaan yang diajukan ke database, bukan sekadar mengisi jawaban.

**Di login TokoKita:** `server.py` membentuk query login dengan menggabungkan username dan password ke teks SQL. Input uji dapat membuat syarat pencarian menjadi selalu benar sehingga response menunjukkan akun admin demo.

**Adegan Kamila:**

1. Tampilkan halaman toko dan bilang alur login terlihat normal.
2. Jun menguji login menggunakan Burp Repeater. Kamila tidak perlu mengetik payload sendiri.
3. Jun menunjukkan response berisi `role: admin`.
4. Kamila bereaksi pada dampaknya: “Jadi sistem percaya pada input tanpa memeriksa kredensial dengan benar.”

**Lab sqlmap:** route `/api/lab/search` adalah jalur latihan tersendiri agar sqlmap dapat digunakan tanpa diarahkan ke tabel akun atau pesanan toko. Route ini membaca `tokokita-lab.db` secara read-only, hanya tabel `lab_products`, maksimal sepuluh hasil, berisi empat produk dummy.

**Peran Kamila di lab:** jelaskan bahwa tool otomatis membantu menguji konsistensi temuan, tetapi pemindaian bisa mengirim banyak request. Jun menjalankannya di localhost sebelum presentasi; di panggung cukup tunjukkan hasil yang disiapkan dan satu request `curl` yang menampilkan fixture.

**Batas:** jangan jalankan sqlmap ke `/api/login`, `/api/orders`, hostname Railway, atau target lain. Tidak perlu dump database. Tidak semua teknik sqlmap cepat; time-based blind bisa sangat lambat.

**Dampak di aplikasi nyata:** login tanpa izin, serta pembacaan atau perubahan data jika query lain juga rentan. Dampak sebenarnya bergantung pada query dan hak database.

**Perbaikan nyata:** prepared atau parameterized statements — input diperlakukan sebagai data, bukan potongan query. Jangan menampilkan detail error SQL kepada pengguna. Pada aplikasi nyata, jangan menyisakan route lab yang sengaja rentan.

### Kategori 2 — Stored XSS

**Apa artinya?** Situs menerima konten pengguna, menyimpannya, lalu menampilkannya sebagai HTML tanpa pengamanan. Browser bisa menjalankan JavaScript dari konten tersebut seolah-olah berasal dari situs.

**Stored** berarti payload tersimpan, bukan hanya ada sementara di alamat halaman. Seseorang yang membuka halaman yang memuat review itu dapat memicu kodenya.

**Adegan dua laptop:**

1. Kamila login sebagai akun admin dummy di browser pada laptopnya.
2. Jun menaruh review uji pada produk melalui laptopnya.
3. Kamila membuka halaman produk yang sama pada browser demo yang dikendalikan tim.
4. Payload membaca cookie Kamila dan mengirimnya ke `/api/collect` pada aplikasi sendiri.
5. Jun membuka `/collector` pada laptopnya untuk menunjukkan bukti cookie demo diterima.

Collector hanya menerima string cookie yang memiliki pasangan tepat `user=kamila` dan panjang maksimal 1024 karakter. Ini pembatas demo, **bukan bukti bahwa stored XSS aman**: payload tetap berjalan pada halaman produk, dan collector tetap menerima token sesi admin dummy yang cocok.

**Peran dan persetujuan:** Kamila harus tahu kapan adegan dimulai, login hanya dengan akun demo, dan menyetujui payload. Jangan gunakan akun pribadi. Jangan menampilkan token aktif terlalu lama ke proyektor atau rekaman; token sesi harus diperlakukan sebagai rahasia sementara.

**Dampak di aplikasi nyata:** script dapat bertindak dalam konteks situs dan, bila cookie bisa dibaca, berpotensi mencuri sesi. Pengunjung yang membuka review dapat terdampak.

**Perbaikan nyata:** encode teks saat ditampilkan; jika rich text diperlukan, sanitasi dengan allowlist; tambah Content Security Policy; cookie sesi memakai `HttpOnly`, `Secure`, dan `SameSite`; rotasi sesi setelah login.

### Kategori 3 — Harga checkout diubah dari sisi browser

**Apa artinya?** Informasi di halaman atau DevTools dikendalikan pengguna. Hidden input bukan tempat aman untuk menyimpan harga.

**Di TokoKita:** browser mengirim `price` ke `POST /api/checkout`; server memakai angka dari request untuk menghitung total. Jun mengubahnya menjadi `100`, sehingga order demo bernilai Rp100.

**Dampak nyata:** manipulasi nilai transaksi, diskon, kuantitas, atau field lain yang dipercaya dari client.

**Perbaikan nyata:** kirim ID produk dan jumlah saja; server membaca harga resmi dari database, memvalidasi stok, lalu menghitung total di server.

**Catatan data:** request checkout berhasil membuat order baru. Jalankan reset setelah demonstrasi.

### Kategori 4 — Sesi lemah

**Apa artinya?** Cookie sesi adalah token yang membantu server mengenali browser yang sudah login. `HttpOnly` adalah perlindungan agar JavaScript halaman tidak dapat membaca cookie tersebut. Di lab, `PHPSESSID` sengaja tidak memakai perlindungan itu, sehingga adegan XSS dapat membaca dan mengirim cookie demo.

Itu baru separuh ceritanya. Cookie `user` juga dipercaya sebagai fallback identitas — dan temuan audit tambahan di Bagian 6 menunjukkan akibatnya bisa lebih langsung daripada pencurian sesi lewat XSS.

**Peran Kamila:** pada adegan XSS, tegaskan bahwa sesi yang dipakai adalah sesi akun demo yang disetujui untuk ditampilkan buktinya, bukan akun pribadi.

**Perbaikan nyata:** cookie sesi memakai `HttpOnly`, `Secure`, dan `SameSite`; identitas pengguna ditentukan dari token sesi yang valid di server, bukan dari cookie berisi username; rotasi sesi setelah login.

### Kategori 5 — IDOR pada pesanan

**Apa artinya?** IDOR adalah kondisi saat aplikasi menerima ID object — misalnya nomor pesanan — tetapi tidak memastikan bahwa pengguna yang meminta memang berhak melihat object itu.

**Di TokoKita:** endpoint `GET /api/orders/201` mencari pesanan berdasarkan ID tanpa memeriksa pemilik. Nomor order bertindak seperti nomor laci; mengganti nomor membuka laci milik akun demo lain.

**Dampak nyata:** kebocoran detail pesanan dan data pribadi. Data alamat dan telepon pada lab hanya data contoh tersamar, bukan data sungguhan.

**Perbaikan nyata:** cek otorisasi kepemilikan di server setiap kali object diminta; gunakan respons yang tidak membocorkan field yang tidak diperlukan.

### Kategori 6 — Upload tanpa validasi dan shell simulasi

**Apa artinya?** Aplikasi menerima file tanpa memastikan jenis, isi, dan ukuran yang aman. Di aplikasi nyata, file yang bisa diakses web atau dieksekusi server dapat berbahaya.

**Di TokoKita:** file upload disimpan tanpa validasi ekstensi. Jika nama berakhiran `.php`, handler demo menampilkan halaman shell dengan output yang sudah ditulis di kode.

> [!NOTE]
> **Ini bukan RCE sungguhan.** Tidak ada command OS yang dijalankan. Jangan menarasikan seolah-olah server berhasil ditembus lewat shell nyata.

**Perbaikan nyata:** allowlist format dan ukuran, validasi isi file, simpan di luar webroot, nama file acak, dan nonaktifkan eksekusi di lokasi upload.

**Untuk presentasi:** lakukan hanya lokal. Jangan upload file ke publik; reset API tidak menghapus upload.

---

## 6. Temuan audit tambahan — di luar adegan demo

Lima temuan berikut nyata di kode, tetapi **bukan adegan demo dan tidak mengubah hitungan 6 kategori / 7 adegan**. Bagian ini ada supaya tidak ada yang mengklaim aplikasi “aman di luar enam kategori itu”, dan supaya Kamila siap jika audiens atau juri bertanya lebih dalam.

| # | Temuan | Kenapa penting | Perbaikan nyata |
| ---: | --- | --- | --- |
| A | Password disimpan plaintext, tanpa hashing | Satu kebocoran database langsung membocorkan semua password apa adanya | Hash password dengan algoritma khusus password, misalnya bcrypt atau argon2 |
| B | Cookie `user=kamila` dipercaya tanpa token | Siapa pun bisa mengatur cookie itu di browser dan dianggap admin — tanpa XSS sama sekali | Identitas hanya dari token sesi yang valid dan terverifikasi di server |
| C | `/api/login` membocorkan error SQL | Pesan error membantu penyerang menyusun payload SQLi berikutnya | Tampilkan pesan generik ke pengguna; catat detail error hanya di log server |
| D | Checkout tanpa login dan tanpa validasi negatif | Pesanan bisa dibuat tanpa akun, dan harga atau jumlah negatif tidak ditolak | Wajib login; validasi harga dari database dan jumlah harus positif |
| E | Upload tanpa login dan tanpa batas ukuran | File bisa diunggah tanpa akun, dan ukuran file tidak dibatasi | Wajib login; tetapkan batas ukuran, allowlist format, dan validasi isi |

**Cara menjelaskan ke audiens, dengan bahasa sederhana:**

- **Password plaintext:** “Password di database kami simpan apa adanya. Di aplikasi nyata itu tidak boleh — password harus disimpan sebagai hash, jadi database bocor pun password aslinya tidak langsung terbaca.”
- **Cookie `user` dipercaya mentah-mentah:** “Ini sebenarnya lebih parah dari cookie yang bisa dicuri. Penyerang tidak perlu mencuri apa pun — cukup menulis sendiri cookie `user=kamila` di browser, server langsung menganggapnya admin.”
- **Error SQL bocor:** “Kalau login gagal dengan cara tertentu, server menjawab dengan detail error databasenya. Itu seperti memberi petunjuk gratis untuk serangan berikutnya.”
- **Checkout dan upload tanpa login:** “Dua endpoint ini tidak memeriksa siapa yang mengirim request, dan tidak memeriksa apakah angka atau ukurannya masuk akal. Di aplikasi nyata, keduanya harus wajib login dan divalidasi di server.”

> [!NOTE]
> Temuan-temuan ini **didokumentasikan, bukan diperbaiki di kode demo**. Celahnya sengaja ada agar demo berjalan; menambalnya di `server.py` akan mematikan adegan presentasi. Perbaikannya adalah pekerjaan setelah presentasi, kalau TokoKita dikembangkan jadi aplikasi sungguhan.

---

## 7. Rundown resmi — 12 menit, satu urutan

Ini satu-satunya urutan panggung yang berlaku. Penomoran **Adegan 1–7** hanya ada di tabel ini; bagian lain memakai nomor kategori agar tidak ada dua penomoran yang bertabrakan.

### Sebelum audiens masuk

- [ ] Jun menguji seluruh langkah pada server lokal; sqlmap dan Nmap selesai sebelumnya.
- [ ] Screenshot singkat hasil sqlmap disiapkan agar tidak menunggu tool di panggung.
- [ ] Kamila login ke akun dummy hanya saat diperlukan.
- [ ] Domain yang dibuka hanya domain aplikasi TokoKita.
- [ ] Tab lain dan notifikasi ditutup. Cookie token mentah tidak ditayangkan.
- [ ] Isyarat berhenti disepakati. Kamila boleh berkata “stop” kapan saja; Jun langsung menghentikan adegan.

### Urutan adegan

| Adegan | Waktu | Layar / aksi | Narasi Kamila |
| ---: | --- | --- | --- |
| — | 0:00–1:00 | Dua laptop menampilkan TokoKita normal | Perkenalkan peran, izin, dan scope |
| — | 1:00–2:00 | Burp membuka halaman; HTTP history muncul | “Ini request yang dikirim browser ke aplikasi.” |
| 1 | 2:00–3:30 | Harga checkout diubah jadi Rp100 | “Harga seharusnya dihitung server, bukan dipercaya dari browser.” |
| 2 | 3:30–5:00 | Order fixture `#201` dibuka | “Nomor pesanan bukan pengganti pemeriksaan hak akses.” |
| 3 | 5:00–6:30 | Burp Repeater menunjukkan SQLi login | “Input login mengubah cara aplikasi bertanya ke database.” |
| 4 | 6:30–7:30 | Screenshot sqlmap lokal dan `curl` fixture | “Tool membantu memastikan parameter lab rentan; database latihan terpisah.” |
| 5 | 7:30–9:30 | Review uji, Kamila membuka produk, Jun menunjukkan collector | “Konten tersimpan dapat berjalan saat dibuka. Ini sesi demo yang saya setujui.” |
| 6 | 9:30–10:15 | Upload dan shell simulasi, hanya jika waktu cukup dan lokal | Tegaskan output palsu, bukan command sungguhan |
| 7 | 10:15–12:00 | Slide temuan dan mitigasi, lalu reset | Tutup dengan pelajaran: validasi dan otorisasi harus dilakukan server |

Nmap bukan pembuka di panggung. Jun menjalankannya sebelumnya pada `127.0.0.1`; hasilnya hanya konteks port lokal, bukan temuan aplikasi.

### Kalimat transisi sederhana

- “Kita mulai dari yang paling terlihat: siapa yang menentukan harga?”
- “Berikutnya, apakah pembeli hanya bisa melihat pesanan miliknya?”
- “Sekarang kita lihat apakah formulir login benar-benar memeriksa password.”
- “Tool otomatis bisa membantu memastikan temuan yang sama di lab terpisah.”
- “Konten review juga bisa menjadi pintu masuk jika browser memperlakukannya sebagai kode.”
- “Terakhir, upload file berisiko. Pada demo ini shell sengaja hanya simulasi.”

---

## 8. Tools yang akan terlihat dan alasan penggunaannya

| Tool | Dipakai untuk | Batas pemakaian |
| --- | --- | --- |
| Burp Suite Community | Mengamati dan mengulang request HTTP; Repeater membandingkan request sebelum dan sesudah perubahan | Tidak perlu Intruder atau fuzzing untuk demo ini |
| sqlmap | Memeriksa otomatis apakah parameter SQLi pada endpoint fixture rentan | Hanya di server lokal, sebelum presentasi; dapat menghasilkan banyak request |
| Nmap | Mengenali service pada port yang dipilih di komputer sendiri | Hanya localhost |
| Browser DevTools | Menunjukkan nilai form dan cookie dalam browser demo | Jangan tampilkan token sesi nyata |
| `curl` | Mengirim satu request sederhana untuk menunjukkan hasil fixture atau status endpoint | Satu request, bukan pemindaian |

Perintah Nmap lokal:

```bash
nmap -sV -p 8000 127.0.0.1
```

Perintah sqlmap lokal terbatas — jalankan sebelum acara, tidak ke web publik:

```bash
sqlmap -u 'http://127.0.0.1:8000/api/lab/search?category=electronics' \
  -p category --batch --flush-session --level=1 --risk=1 \
  --technique=BEU --timeout=5 --retries=0
```

`BEU` membatasi teknik ke boolean, error, dan UNION; hindari `T` karena time-based extraction lambat. Jangan pakai `--dump`, `--all`, `--os-shell`, atau opsi baca dan tulis file.

---

## 9. Data, risiko demo publik, dan tombol berhenti

### Risiko yang perlu Kamila pahami

1. **Review XSS tersimpan.** Payload tetap berada di database sampai di-reset. Jika pengunjung lain membuka halaman yang sama sebelum reset, browsernya dapat menjalankannya. Adegan harus singkat dan payload dihapus segera.
2. **Cookie adalah token sesi.** Jangan memperlihatkan atau menyebarkan token. Setelah demo, matikan deployment; selama masih hidup, jangan gunakan akun admin untuk hal lain.
3. **Akun demo punya password lemah.** Jangan gunakan kembali. Jangan masukkan informasi asli ke profil, review, atau order.
4. **Reset bukan tombol universal.** Reset memulihkan review, override harga, nama toko, dan order checkout baru. Ia tidak menghapus upload, isi collector, atau database fixture lab.
5. **Upload publik dihindari.** File yang diunggah bisa tetap ada sampai redeploy atau container berganti.
6. **Hosting bersama bukan scope.** Tidak ada scan port, subnet, atau domain Railway. Jangan memakai Nmap terhadap URL atau IP publik.

### Kapan berhenti

- URL atau host yang muncul bukan domain TokoKita.
- Ada informasi yang tampak sungguhan atau bukan data demo.
- Payload akan berjalan di browser orang yang tidak ikut presentasi.
- Ada error yang mendorong untuk memperluas scan atau meningkatkan intensitas.
- Kamila meminta berhenti.

Jika ada kendala, gunakan screenshot atau rekaman. Jangan mencoba target lain untuk “membuat demo berhasil”.

---

## 10. Pembersihan setelah tiap latihan dan setelah acara

### Reset aplikasi

Saat login sebagai Kamila, jalankan di Console browser aplikasi:

```js
fetch('/api/seller/reset', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

Setelah reset, periksa:

- [ ] `GET /api/prices` mengembalikan `{ "prices": {} }`.
- [ ] Review kembali ke seed.
- [ ] Nama toko kembali normal.
- [ ] Order checkout baru hilang.

Yang **tidak** dibersihkan reset:

| Sisa setelah reset | Cara membersihkan |
| --- | --- |
| File upload | Hapus manual dari lokasi upload, atau redeploy |
| Isi collector | Restart atau redeploy aplikasi — collector tersimpan di memori proses |
| Database fixture lab | Tidak perlu dibersihkan; isinya empat produk dummy read-only |

Jangan simpan screenshot yang menampilkan token sesi.

### Setelah presentasi

1. Jun menjalankan reset aplikasi dan memverifikasi data seed.
2. Pemilik layanan mematikan deployment Railway segera setelah presentasi selesai. Ini tindakan terpisah dari reset data.
3. Hapus screenshot dan log yang memuat cookie sesi atau informasi yang tidak perlu.
4. Pastikan URL demo tidak lagi merespons setelah shutdown.

Jangan menghapus database atau melakukan redeploy sendiri kecuali memang punya akses dan persetujuan pemilik layanan.

---

## 11. Pertanyaan audiens dan jawaban singkat

**“Apakah kalian benar-benar membobol Railway?”**
Tidak. Kami menguji logika aplikasi TokoKita. Hosting dan infrastrukturnya tidak dipindai.

**“Apakah shell upload bisa menjalankan Linux command?”**
Tidak. Halaman shell hanya memilih output palsu dari daftar di kode. Tidak ada command OS yang berjalan.

**“Apakah semua akun itu orang sungguhan?”**
Tidak. Akun dan record dibuat untuk demo. Tidak ada data pelanggan sungguhan yang seharusnya dimasukkan.

**“Apakah sqlmap mencuri database toko?”**
Tidak pada skenario ini. Uji sqlmap diarahkan lokal ke tabel terpisah berisi empat produk sintetis; tidak ada opsi dump.

**“Bagaimana mencegah SQL injection?”**
Gunakan prepared statements agar input selalu dianggap data, bukan bagian dari perintah SQL.

**“Apakah mengubah harga di browser berarti pembayaran sungguhan berhasil?”**
Tidak ada payment gateway atau transaksi uang sungguhan. Ini hanya menunjukkan nilai total order demo dapat dimanipulasi.

**“Apakah XSS berarti semua pengunjung pasti terkena?”**
Hanya browser yang membuka halaman dengan payload tersimpan yang memicunya. Karena itu review harus segera dibersihkan dan demo dilakukan dengan akun dan browser yang dikendalikan presenter.

**“Katanya ada temuan di luar enam kategori itu?”**
Betul — password tersimpan tanpa hashing, cookie `user` yang bisa ditulis sendiri untuk jadi admin, error SQL yang bocor, serta checkout dan upload tanpa login. Semuanya terdokumentasi di Bagian 6 dokumen ini. Enam kategori adalah yang didemokan; temuan tambahan itu nyata, tetapi tidak kami jadikan adegan panggung.

---

## 12. Catatan koreksi dan item terbuka

Versi ini memperbaiki lima hal yang ditemukan saat audit repo dan dokumen. Catatan ini disimpan di dokumen agar siapa pun yang membaca versi terkoreksi tahu apa yang berubah dan kenapa.

| # | Yang diperbaiki | Sebelumnya | Sekarang |
| ---: | --- | --- | --- |
| 1 | Hitungan kerentanan | Berbeda-beda antar dokumen: 6 kategori / 7 baris di panduan ini, angka lain di `demo-runbook.md` dan README, sesi dihitung sebagai bagian XSS | Satu angka resmi di semua bagian dokumen ini: **6 kategori, 7 adegan**; sesi lemah adalah kategori tersendiri |
| 2 | Urutan rundown | Panduan ini mulai dari harga, `demo-runbook.md` mulai dari SQLi | Satu urutan resmi di Bagian 7: harga → IDOR → SQLi login → sqlmap → XSS → upload → mitigasi dan reset. Dokumen teknis lain perlu diselaraskan ke urutan ini |
| 3 | Link panduan di README | README menunjuk `docs/panduan-kamila.md`, path yang tidak ada di repo | Path yang benar adalah `docs/runbook.md` — README di repo masih perlu diubah ke path ini |
| 4 | Celah yang belum terdokumentasi | Lima celah tambahan ada di kode tetapi tidak disebut di runbook | Didokumentasikan di Bagian 6, tanpa mengubah kode demo |
| 5 | File `mitm_mcp_traffic.db` | Ikut ter-commit di repo tanpa penjelasan di dokumen mana pun | **Item terbuka — belum diputuskan**, lihat di bawah |

### Item terbuka: `mitm_mcp_traffic.db`

File database ini ada di repo, tetapi tidak dijelaskan di README, runbook, maupun dokumen teknis. Belum ada keputusan soal file ini, dan dokumen ini tidak mengklaim file tersebut sudah dihapus.

Pilihan yang perlu diputuskan pemilik repo:

- **Hapus dari repo** jika file itu tidak sengaja ter-commit — menghapus dari GitHub memerlukan commit dan push, bukan cukup menghapus file lokal.
- **Tambahkan ke `.gitignore`** jika file sejenis akan terus dihasilkan lokal agar tidak ter-commit lagi.
- **Dokumentasikan** jika file itu memang bagian proyek yang disengaja — jelaskan isi dan asal-usulnya di README.

---

## 13. Referensi internal

- Panduan demo untuk Kamila (dokumen ini): `docs/runbook.md`
- Langkah teknis dan command: `docs/demo-runbook.md` — urutan rundown di dalamnya perlu diselaraskan dengan Bagian 7 dokumen ini.
- Ringkasan aplikasi dan cara menjalankan: `README.md` — link panduannya perlu diperbaiki menjadi `docs/runbook.md`.
- Repo: [TheFoolByte/tokokita-web](https://github.com/TheFoolByte/tokokita-web)

Semua akun dan record adalah sintetis; deployment publik hanya berlangsung sementara untuk presentasi dan harus dimatikan sesudahnya.

---

## Checklist terakhir sebelum naik panggung

- [ ] Semua penyebutan jumlah sudah “6 kategori, 7 adegan” — tidak ada angka lain.
- [ ] Rundown yang dipegang Jun dan Kamila sama: harga → IDOR → SQLi login → sqlmap → XSS → upload → mitigasi dan reset.
- [ ] Link panduan di README repo sudah mengarah ke `docs/runbook.md`.
- [ ] Kamila bisa menjelaskan lima temuan tambahan di Bagian 6 dengan bahasa sederhana.
- [ ] Screenshot hasil sqlmap dan Nmap lokal sudah siap; tidak ada tool pemindaian yang dijalankan ke target publik.
- [ ] Reset sudah dicoba sekali di lokal dan hasilnya terverifikasi.
- [ ] Keputusan soal `mitm_mcp_traffic.db` sudah diambil, atau minimal sudah dicatat sebagai item terbuka.
- [ ] Rencana mematikan deployment setelah acara sudah jelas siapa yang menjalankan.
