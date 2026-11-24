# Peta Kapabilitas: Demo Pentest Publik TokoKita

| ID modul | Tanggung jawab | Bergantung pada |
|---|---|---|
| `sqlmap-lab` | Pencarian read-only yang sengaja rentan SQL injection, memakai data sintetis khusus; panduan sqlmap dengan batas ketat | — |
| `burp-lab` | Alur intersepsi dan pengiriman ulang request untuk celah TokoKita yang sudah ada | — |
| `nmap-scope` | Panduan Nmap yang aman, hanya ke server TokoKita lokal milik tim | — |
| `demo-guide` | Runbook presenter: scope, temuan, langkah tools, mitigasi, pembersihan, dan rencana cadangan | `sqlmap-lab`, `burp-lab`, `nmap-scope` |

Urutan pengerjaan: `sqlmap-lab`, `burp-lab`, `nmap-scope` → `demo-guide`.

## Batas keamanan bersama

- Target publik hanya aplikasi TokoKita; jangan menguji control plane Railway, edge hosting, layanan metadata, layanan lain, atau sistem milik pihak lain.
- Skenario tools otomatis yang baru memakai fixture sintetis dan tidak boleh membaca atau mengubah akun, pesanan, sesi, ulasan, atau data penjual yang sudah ada.
- Tidak ada eksekusi perintah sungguhan, akses shell, pencurian kredensial non-demo, atau operasi database destruktif.
- Demo cookie hanya memakai sesi admin dummy Kamila yang dikendalikan presenter; collector menolak cookie selain sesi admin demo.
- Langkah reset dan verifikasi harus mengembalikan data demo publik ke kondisi seed yang bersih.
