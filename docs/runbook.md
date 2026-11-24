# Panduan Presenter untuk Kamila

## Baca ini sebelum demo

Dokumen ini ditujukan untuk Kamila sebagai pemeran pemilik toko. Kamu tidak perlu punya latar belakang keamanan siber. Tujuannya agar kamu tahu apa yang sedang ditampilkan, apa dampaknya, bagian mana yang simulasi, dan kapan harus menghentikan adegan.

**TokoKita adalah aplikasi latihan yang sengaja dibuat rentan.** Pengujian hanya boleh menyasar aplikasi TokoKita yang menjadi target demo. Jangan menguji Railway, server/edge hosting, jaringan kampus, akun atau sistem pihak lain. Jangan gunakan data pribadi, password asli, atau akun yang dipakai di layanan lain.

Aplikasi ini publik selama masa demo. Celah stored XSS dapat berjalan di browser siapa pun yang membuka ulasan berbahaya sebelum dibersihkan. Karena itu, jalankan presentasi dalam jendela waktu yang disepakati, gunakan akun dan browser demo, lalu segera reset data setelah adegan. Pemilik proyek bertanggung jawab mematikan deployment setelah presentasi.

---

## 1. Cerita yang akan dibawakan

- **Kamila** berperan sebagai pemilik TokoKita yang mengira alur toko berjalan normal.
- **Jun** berperan sebagai penguji yang mendapat izin dari pemilik.
- Audiens melihat dua laptop/proyektor: Kamila menunjukkan sisi pemilik; Jun menunjukkan bagaimana request aplikasi dapat diuji.
- Semua username, password, pesanan, dan produk pada seed adalah data dummy.
- Ceritanya bukan “membobol Railway”. Ceritanya adalah menemukan kesalahan pada logika aplikasi TokoKita.

Kalimat pembuka yang bisa digunakan:

> “Saya Kamila, pemilik TokoKita. Jun menguji aplikasi demo ini dengan izin saya. Semua akun dan data dibuat khusus untuk latihan. Pengujian hanya mencakup aplikasi TokoKita, bukan layanan hosting atau sistem lain.”

---

## 2. Istilah dasar tanpa jargon

| Istilah | Penjelasan sederhana |
|---|---|
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

Kode status yang mungkin terlihat di Burp/log:
- `200`: request diproses berhasil.
- `304`: browser menggunakan aset yang sudah di-cache; bukan kegagalan.
- `400`: request/payload tidak cocok atau input ditolak.
- `401`: belum terautentikasi atau kredensial salah.
- `403`: identitas tidak punya izin.
- `404`: route/record tidak ditemukan atau sengaja disembunyikan.
- Bar merah pada Railway logs tidak otomatis berarti error; lihat status HTTP dan isi pesannya.

---

## 3. TokoKita dari hulu ke hilir

1. Pengguna membuka halaman HTML toko.
2. Browser memuat CSS, JavaScript, dan gambar produk.
3. JavaScript mengirim request ke API Python yang berjalan di server.
4. Server membaca/menulis database SQLite dan mengirim response JSON.
5. Browser menampilkan hasilnya.

Bagian utama proyek:
- `index.html`, `pages/`, `css/`, `assets/`: halaman dan tampilan toko.
- `js/auth.js`: alur login, register, logout, dan pemulihan sesi browser.
- `js/app.js`: katalog, review, checkout, pesanan, upload, dan dashboard penjual.
- `server.py`: API, sesi, database, static files, serta skenario rentan.
- `tokokita.db`: data utama aplikasi.
- `tokokita-lab.db`: database terpisah dengan empat produk dummy untuk latihan sqlmap.
- `tests/smoke_test.py`: tes otomatis bahwa perilaku demo tetap sesuai skenario.

Di Railway, server aplikasi menerima request melalui HTTPS publik. Railway juga menjadi penyedia hosting, tetapi **infrastruktur Railway bukan bagian dari target**. Jangan melakukan pemindaian jaringan/port terhadap Railway.

### Data dan akun demo

Ada 12 akun seed sintetis:
- Admin/pemilik: `kamila / kamila123`.
- Pembeli: `rohandhika / rohandhika123`, `sari / sari123`, `jun / jun12345`, `budi / budi12345`, `maya / maya12345`, `dimas / dimas12345`, `nina / nina12345`, `raka / raka12345`, `lila / lila12345`, `fajar / fajar12345`, `dewi / dewi12345`.

Akun dummy tambahan terutama untuk latihan login dan kontrol akses. Pesanan seed yang memang ada saat ini: `#101` dan `#102` milik Rohandhika, `#201` milik Kamila, serta `#202` dan `#203` milik Sari. Akun tambahan tidak otomatis memiliki pesanan masing-masing.

Password tersebut hanya untuk lab. Jangan gunakan di email, akun pribadi, atau layanan lain.

---

## 4. Berapa banyak kerentanan?

Hitungan yang paling jujur untuk presentasi: **6 kategori kelemahan aplikasi**. Ada beberapa adegan/endpoint yang menunjukkan kategori sama. Nmap bukan kerentanan aplikasi; itu hanya alat pengamatan server lokal.

| # | Kategori | Lokasi utama | Demo |
|---|---|---|---|
| 1 | SQL Injection (SQLi) | `POST /api/login` | Input login mengubah query dan melewati login demo. |
| 2 | SQL Injection khusus lab | `GET /api/lab/search?category=...` | sqlmap mendeteksi query rentan; database hanya berisi empat fixture sintetis dan terpisah. Ini latihan SQLi kedua, bukan kategori baru. |
| 3 | Stored Cross-Site Scripting (stored XSS) | `POST /api/reviews`, lalu review ditampilkan pada halaman produk | HTML berbahaya disimpan dan dijalankan saat halaman review dibuka. |
| 4 | Perlindungan sesi lemah | Cookie `PHPSESSID` tidak memakai `HttpOnly`; cookie `user` juga dipercaya sebagai fallback identitas | JavaScript dapat membaca cookie demo; adegan collector dibatasi ke cookie admin Kamila. |
| 5 | Harga dipercaya dari browser | `POST /api/checkout` | Harga item diubah menjadi Rp100 sebelum server menghitung total. |
| 6 | IDOR (akses object tanpa cek pemilik) | `GET /api/orders/<id>` | ID order fixture diganti untuk membaca pesanan demo akun lain. |
| 7 | Upload tanpa validasi memadai | `POST /api/upload` | Server menerima file dummy/ekstensi tanpa validasi. Shell di URL upload hanyalah simulasi. |

Tabel memuat tujuh baris karena SQLi dibedakan menjadi dua demonstrasi. Jika mengelompokkan SQLi sebagai satu kategori, ada **enam kategori**: SQLi, stored XSS, kelemahan sesi, manipulasi harga, IDOR, dan upload. Hal ini penting agar presentasi tidak mengklaim jumlah yang membingungkan.

### Bukan kerentanan sungguhan di lab

- `nmap -sV -p 8000 127.0.0.1` hanya mengenali port server demo yang berjalan di laptop sendiri. Jangan arahkan ke Railway.
- URL `/uploads/shell.php?cmd=whoami` menampilkan teks output yang sudah ditulis di kode. Tidak menjalankan perintah Linux dan bukan remote code execution (RCE).
- Header yang menyebut Apache/PHP adalah banner simulasi; backend sebenarnya Python stdlib.
- `tokokita-lab.db` hanya berisi empat produk latihan; tidak ada akun/pesanan di dalamnya.

---

## 5. Penjelasan tiap kerentanan dan peran Kamila

### A. SQL Injection pada login

**Apa artinya?** Aplikasi menyimpan data dengan SQL. Jika program menempelkan teks dari formulir langsung ke query, masukan tertentu dapat mengubah arti query tersebut. Ini seperti pengguna mengubah pertanyaan yang diajukan ke database, bukan sekadar mengisi jawaban.

**Di TokoKita:** `server.py` membentuk query login dengan menggabungkan username dan password ke teks SQL. Input uji dapat membuat syarat pencarian menjadi selalu benar sehingga response menunjukkan akun admin demo.

**Adegan Kamila:**
1. Tampilkan halaman toko dan bilang alur login terlihat normal.
2. Jun menguji login menggunakan Burp Repeater. Kamila tidak perlu mengetik payload sendiri.
3. Jun menunjukkan response berisi `role: admin`.
4. Kamila bereaksi pada dampaknya: “Jadi sistem percaya pada input tanpa memeriksa kredensial dengan benar.”

**Dampak di aplikasi nyata:** login tanpa izin, pembacaan/perubahan data jika query lain juga rentan. Dampak sebenarnya bergantung pada query dan hak database.

**Perbaikan nyata:** prepared/parameterized statements; input diperlakukan sebagai data, bukan potongan query. Jangan menampilkan detail error SQL kepada pengguna.

### B. SQLi fixture khusus sqlmap

**Apa bedanya?** Ini jalur latihan tersendiri agar sqlmap dapat digunakan tanpa diarahkan ke tabel akun atau pesanan toko.

**Di TokoKita:** route `/api/lab/search` membaca `tokokita-lab.db`, hanya tabel `lab_products`, maksimal sepuluh hasil, dan koneksi query mode read-only. Data terdiri dari empat produk dummy.

**Peran Kamila:** jelaskan bahwa tool otomatis membantu menguji konsistensi temuan, tetapi pemindaian bisa mengirim banyak request. Jun menjalankannya di localhost sebelum presentasi; saat di panggung cukup tunjukkan hasil yang disiapkan dan satu request `curl` yang menampilkan fixture.

**Batas:** jangan jalankan sqlmap ke `/api/login`, `/api/orders`, hostname Railway, atau target lain. Tidak perlu dump database. Tidak semua teknik sqlmap cepat; time-based blind bisa sangat lambat.

**Perbaikan nyata:** parameterized query juga di endpoint ini. Pada aplikasi nyata, jangan menyisakan route lab yang sengaja rentan.

### C. Stored XSS dan cookie sesi

**Apa artinya?** Situs menerima konten pengguna, menyimpannya, lalu menampilkannya sebagai HTML tanpa pengamanan. Browser bisa menjalankan JavaScript dari konten tersebut seolah-olah berasal dari situs.

**Stored** berarti payload tersimpan, bukan hanya ada sementara di alamat halaman. Seseorang yang membuka halaman yang memuat review itu dapat memicu kodenya.

**Cookie sesi** adalah token yang membantu server mengenali browser yang sudah login. `HttpOnly` adalah perlindungan agar JavaScript halaman tidak dapat membaca cookie tersebut. Di lab, `PHPSESSID` sengaja tidak memakai perlindungan itu.

**Adegan dua laptop:**
1. Kamila login sebagai akun admin dummy di browser pada laptopnya.
2. Jun menaruh review uji pada produk melalui laptopnya.
3. Kamila membuka halaman produk yang sama pada browser demo yang dikendalikan tim.
4. Payload membaca cookie Kamila dan mengirimnya ke `/api/collect` pada aplikasi sendiri.
5. Jun membuka `/collector` pada laptopnya untuk menunjukkan bukti cookie demo diterima.

Collector saat ini hanya menerima string cookie yang memiliki pasangan tepat `user=kamila` dan panjang maksimal 1024 karakter. Ini pembatas demo, **bukan bukti bahwa stored XSS aman**: payload tetap berjalan pada halaman produk, dan kolektor tetap menerima token sesi admin dummy yang cocok.

**Peran dan persetujuan:** Kamila harus tahu kapan adegan dimulai, login hanya dengan akun demo, dan menyetujui payload. Jangan gunakan akun pribadi. Jangan menampilkan token aktif terlalu lama ke proyektor atau rekaman; token sesi harus diperlakukan sebagai rahasia sementara.

**Dampak di aplikasi nyata:** script dapat bertindak dalam konteks situs dan, bila cookie bisa dibaca, berpotensi mencuri sesi. Pengunjung yang membuka review dapat terdampak.

**Perbaikan nyata:** encode teks saat ditampilkan; jika rich text diperlukan, sanitasi dengan allowlist; tambah Content Security Policy; cookie sesi `HttpOnly`, `Secure`, `SameSite`; rotasi sesi setelah login.

### D. Harga checkout diubah dari sisi browser

**Apa artinya?** Informasi di halaman/DevTools dikendalikan pengguna. Hidden input bukan tempat aman untuk menyimpan harga.

**Di TokoKita:** browser mengirim `price` ke `POST /api/checkout`; server memakai angka dari request untuk menghitung total. Jun mengubahnya menjadi `100`, sehingga order demo bernilai Rp100.

**Dampak nyata:** manipulasi nilai transaksi, diskon, kuantitas, atau field lain yang dipercaya dari client.

**Perbaikan nyata:** kirim ID produk dan jumlah saja; server membaca harga resmi dari database, memvalidasi stok, lalu menghitung total server-side.

**Catatan data:** request checkout berhasil membuat order baru. Jalankan reset setelah demonstrasi.

### E. IDOR pada pesanan

**Apa artinya?** IDOR adalah kondisi saat aplikasi menerima ID object—misalnya nomor pesanan—tetapi tidak memastikan bahwa pengguna yang meminta memang berhak melihat object itu.

**Di TokoKita:** endpoint `GET /api/orders/201` mencari pesanan berdasarkan ID tanpa memeriksa pemilik. Nomor order bertindak seperti nomor laci; mengganti nomor membuka laci milik akun demo lain.

**Dampak nyata:** kebocoran detail pesanan dan data pribadi. Data alamat/telepon pada lab hanya data contoh tersamar, bukan data sungguhan.

**Perbaikan nyata:** cek otorisasi kepemilikan pada server setiap kali object diminta; gunakan respons yang tidak membocorkan field yang tidak diperlukan.

### F. Upload tanpa validasi dan shell simulasi

**Apa artinya?** Aplikasi menerima file tanpa memastikan jenis/isi/ukuran yang aman. Di aplikasi nyata, file yang bisa diakses web atau dieksekusi server dapat berbahaya.

**Di TokoKita:** file upload disimpan tanpa validasi ekstensi. Jika nama berakhiran `.php`, handler demo menampilkan halaman shell dengan output hard-coded.

**Penting:** tidak ada command OS yang dijalankan. Ini **bukan RCE sungguhan**. Jangan menarasikan seolah-olah server berhasil ditembus lewat shell nyata.

**Perbaikan nyata:** allowlist format dan ukuran, validasi isi file, simpan di luar webroot, nama file acak, dan nonaktifkan eksekusi di lokasi upload.

**Untuk presentasi:** lakukan hanya lokal. Jangan upload file ke publik; reset API tidak menghapus upload.

---

## 6. Alur acara dua laptop (12 menit)

### Sebelum audiens masuk

- Jun menguji seluruh langkah pada server lokal; sqlmap dan Nmap selesai sebelumnya.
- Siapkan screenshot singkat hasil sqlmap agar tidak menunggu tool di panggung.
- Kamila login ke akun dummy hanya saat diperlukan.
- Pastikan domain yang dibuka hanya domain aplikasi TokoKita.
- Tutup tab lain/notifikasi. Jangan menayangkan cookie token mentah.
- Sepakati isyarat berhenti. Kamila boleh berkata “stop” kapan saja; Jun langsung menghentikan adegan.

### Rundown

| Waktu | Layar/aksi | Peran Kamila dan narasi |
|---|---|---|
| 0:00–1:00 | Dua laptop menampilkan TokoKita normal | Perkenalkan peran, izin, dan scope. |
| 1:00–2:00 | Browser Burp membuka halaman; HTTP history muncul | “Ini request yang dikirim browser ke aplikasi.” |
| 2:00–3:30 | Jun tunjukkan harga checkout berubah jadi Rp100 | “Harga seharusnya dihitung server, bukan dipercaya dari browser.” |
| 3:30–5:00 | Jun buka order fixture #201 | “Nomor pesanan bukan pengganti pemeriksaan hak akses.” |
| 5:00–6:30 | Burp Repeater menunjukkan SQLi login | “Input login mengubah cara aplikasi bertanya ke database.” |
| 6:30–7:30 | Screenshot sqlmap lokal + curl fixture | “Tool membantu memastikan parameter lab rentan; database latihan terpisah.” |
| 7:30–9:30 | Review uji, Kamila membuka produk, Jun menunjukkan collector | “Konten tersimpan dapat berjalan saat dibuka. Ini sesi demo yang saya setujui.” |
| 9:30–10:15 | Upload/shell simulasi hanya jika waktu cukup dan lokal | Tegaskan output palsu, bukan command sungguhan. |
| 10:15–12:00 | Slide temuan dan mitigasi | Tutup dengan pelajaran: validasi/otorisasi harus dilakukan server. Reset setelahnya. |

Nmap bukan pembuka di panggung. Jun menjalankannya sebelumnya pada `127.0.0.1`; hasilnya hanya konteks port lokal, bukan temuan aplikasi.

### Kalimat transisi sederhana

- “Kita mulai dari yang paling terlihat: siapa yang menentukan harga?”
- “Berikutnya, apakah pembeli hanya bisa melihat pesanan miliknya?”
- “Sekarang kita lihat apakah formulir login benar-benar memeriksa password.”
- “Konten review juga bisa menjadi pintu masuk jika browser memperlakukannya sebagai kode.”
- “Terakhir, upload file berisiko. Pada demo ini shell sengaja hanya simulasi.”

---

## 7. Tools yang akan terlihat dan alasan penggunaannya

- **Burp Suite Community:** mengamati dan mengulang request HTTP. Tab Repeater membantu membandingkan request sebelum/sesudah perubahan. Tidak perlu memakai Intruder atau fuzzing untuk demo ini.
- **sqlmap:** memeriksa secara otomatis apakah parameter SQLi pada endpoint fixture rentan. Jalankan hanya di server lokal, sebelum presentasi; dapat menghasilkan banyak request.
- **Nmap:** mengenali service pada port yang dipilih di komputer sendiri. Perintah demo hanya localhost.
- **Browser DevTools:** menunjukkan nilai form/cookie dalam browser demo; jangan tampilkan token sesi nyata.
- **curl:** mengirim satu request sederhana dan cepat untuk menunjukkan hasil fixture atau memeriksa status endpoint.

Perintah Nmap lokal:

```bash
nmap -sV -p 8000 127.0.0.1
```

Perintah sqlmap lokal terbatas (jalankan sebelum acara; tidak ke web publik):

```bash
sqlmap -u 'http://127.0.0.1:8000/api/lab/search?category=electronics' \
  -p category --batch --flush-session --level=1 --risk=1 \
  --technique=BEU --timeout=5 --retries=0
```

`BEU` membatasi teknik ke boolean/error/UNION; hindari `T` karena time-based extraction lambat. Jangan pakai `--dump`, `--all`, `--os-shell`, atau opsi baca/tulis file.

---

## 8. Data, risiko demo publik, dan tombol berhenti

### Risiko yang perlu Kamila pahami

1. **Review XSS tersimpan.** Payload akan tetap berada di database sampai di-reset. Jika pengunjung lain membuka halaman yang sama sebelum reset, browsernya dapat menjalankannya. Karena itu adegan harus singkat dan payload dihapus segera.
2. **Cookie adalah token sesi.** Jangan memperlihatkan atau menyebarkan token. Setelah demo, matikan deployment; selama masih hidup, jangan gunakan akun admin untuk hal lain.
3. **Akun demo punya password lemah.** Jangan gunakan kembali. Jangan masukkan informasi asli ke profile/review/order.
4. **Reset bukan tombol universal.** Reset memulihkan review, override harga, nama toko dan order checkout baru. Ia tidak menghapus upload atau database fixture lab.
5. **Upload publik dihindari.** File yang diunggah bisa tetap ada sampai redeploy/container berganti.
6. **Hosting bersama bukan scope.** Tidak ada scan port/subnet/domain Railway. Jangan memakai Nmap terhadap URL/IP publik.

### Kapan berhenti

- URL/host yang muncul bukan domain TokoKita.
- Ada informasi yang tampak sungguhan atau bukan data demo.
- Payload akan berjalan di browser orang yang tidak ikut presentasi.
- Ada error yang mendorong untuk memperluas scan/meningkatkan intensitas.
- Kamila meminta berhenti.

Jika ada kendala, gunakan screenshot/rekaman. Jangan mencoba target lain untuk “membuat demo berhasil”.

---

## 9. Pembersihan setelah tiap latihan dan setelah acara

### Reset aplikasi

Saat login sebagai Kamila, jalankan di Console browser aplikasi:

```js
fetch('/api/seller/reset', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

Cek `GET /api/prices` mengembalikan `{ "prices": {} }`, review kembali ke seed, nama toko kembali normal, dan order checkout baru hilang.

Collector menyimpan hasil di memori proses dan reset API toko tidak menghapus daftar itu. Restart/redeploy aplikasi membersihkan collector in-memory. Jangan simpan screenshot yang menampilkan token sesi.

### Setelah presentasi

1. Jun jalankan reset aplikasi dan verifikasi data seed.
2. Pemilik layanan mematikan deployment Railway segera setelah presentasi selesai. Ini tindakan terpisah dari reset data.
3. Hapus screenshot/log yang memuat cookie sesi atau informasi yang tidak perlu.
4. Pastikan URL demo tidak lagi merespons setelah shutdown.

Jangan menghapus database atau melakukan redeploy sendiri kecuali memang punya akses dan persetujuan pemilik layanan.

---

## 10. Pertanyaan audiens dan jawaban singkat

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
Hanya browser yang membuka halaman dengan payload tersimpan yang memicunya. Karena itu review harus segera dibersihkan dan demo dilakukan dengan akun/browser yang dikendalikan presenter.

---

## 11. Referensi internal

- Langkah teknis dan command: [`demo-runbook.md`](demo-runbook.md).
- Ringkasan aplikasi dan cara menjalankan: [`../README.md`](../README.md).
- Semua akun/record adalah sintetis; deployment publik hanya berlangsung sementara untuk presentasi dan harus dimatikan sesudahnya.
