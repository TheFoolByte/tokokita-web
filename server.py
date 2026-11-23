#!/usr/bin/env python3
"""TokoKita — server demo RENTAN (lab lokal).

Semua celah di file ini SENGAJA dibuat:
  - SQL injection di /api/login
  - IDOR di /api/orders/<id>
  - Harga checkout dipercaya dari client (/api/checkout)
  - Stored XSS di ulasan (server menyimpan teks mentah)
  - Upload file tanpa validasi + shell PHP SIMULASI

Unix shell di /uploads/*.php hanya mengembalikan output palsu. Tidak ada
perintah sistem yang dijalankan.

Jalankan : python3 server.py
Buka     : http://127.0.0.1:8000
Reset DB : hapus tokokita.db lalu jalankan ulang.
"""

import argparse
import datetime
import html
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import urllib.parse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.environ.get("TOKOKITA_UPLOADS", os.path.join(ROOT, "uploads"))
DB = os.environ.get("TOKOKITA_DB", os.path.join(ROOT, "tokokita.db"))

SESSIONS = {}   # token -> username
STOLEN = []     # cookie hasil XSS, untuk halaman /collector

SEED_ORDERS = [
    (101, "rohandhika", "Keyboard Mechanical RGB Hot-Swap 75%", 749000, "Rohandhika", "Jl. Sudirman No. 12, Medan", "0813-xxxx-2210", "Sedang Dikirim"),
    (102, "rohandhika", "Tas Ransel Laptop Anti Air 15,6 Inci", 349000, "Rohandhika", "Jl. Sudirman No. 12, Medan", "0813-xxxx-2210", "Selesai"),
    (201, "kamila", "Laptop ASUS Vivobook 14 (stok toko)", 8999000, "Kamila", "Jl. Merdeka No. 45, Medan", "0812-xxxx-8899", "Selesai"),
    (202, "sari", "Headphone Sony WH-1000XM5", 4299000, "Sari Dewi", "Jl. Gatot Subroto No. 8, Medan", "0821-xxxx-3345", "Dikemas"),
    (203, "sari", "Sepatu Running AirFlex Putih", 899000, "Sari Dewi", "Jl. Gatot Subroto No. 8, Medan", "0821-xxxx-3345", "Selesai"),
]

SEED_REVIEWS = [
    (1, "Sari", "Barangnya original, pengiriman cepat. Recommended seller!"),
    (1, "Rohandhika", "Laptopnya kencang buat kuliah dan editing ringan. Baterai awet seharian."),
]

# Output palsu untuk shell simulasi. Tidak ada eksekusi perintah.
SHELL_OUTPUTS = {
    "whoami": "www-data",
    "id": "uid=33(www-data) gid=33(www-data) groups=33(www-data)",
    "pwd": "/var/www/tokokita/uploads",
    "ls": "index.php  uploads  config.php  .env  backup.sql",
    "uname -a": "Linux tokokita-prod 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux",
    "cat /etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n",
    "cat .env": "DB_HOST=localhost\nDB_USER=tokokita\nDB_PASS=tokokita_prod_2026\n",
}

ONE_PIXEL_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
    b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
    b"\x00\x02\x02D\x01\x00;"
)


# ---------------------------------------------------------------- database
def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def get_setting(conn, key, default=""):
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def init_db():
    conn = db()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT,
                label TEXT,
                email TEXT UNIQUE
            );
            CREATE TABLE IF NOT EXISTS orders(
                id INTEGER PRIMARY KEY,
                owner TEXT,
                item TEXT,
                total INTEGER,
                name TEXT,
                addr TEXT,
                phone TEXT,
                status TEXT
            );
            CREATE TABLE IF NOT EXISTS reviews(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pid INTEGER,
                author TEXT,
                text TEXT,
                created TEXT
            );
            CREATE TABLE IF NOT EXISTS settings(
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS product_prices(
                product_id INTEGER PRIMARY KEY,
                price INTEGER
            );
            """
        )
        if not conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            conn.executemany(
                "INSERT INTO users(username, password, role, label, email) VALUES (?,?,?,?,?)",
                [
                    ("kamila", "kamila123", "admin", "Kamila", "kamila@tokokita.id"),
                    ("rohandhika", "rohandhika123", "user", "Rohandhika", "rohandhika@tokokita.id"),
                ],
            )
        if not conn.execute("SELECT 1 FROM orders LIMIT 1").fetchone():
            conn.executemany(
                "INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)", SEED_ORDERS
            )
        if not conn.execute("SELECT 1 FROM reviews LIMIT 1").fetchone():
            now = datetime.datetime.now().isoformat(timespec="seconds")
            conn.executemany(
                "INSERT INTO reviews(pid, author, text, created) VALUES (?,?,?,?)",
                [(pid, author, text, now) for pid, author, text in SEED_REVIEWS],
            )
        if not conn.execute("SELECT 1 FROM settings LIMIT 1").fetchone():
            conn.execute(
                "INSERT INTO settings(key, value) VALUES ('store_name', ?)",
                ("TokoKita Official Store",),
            )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------- handler
class Handler(SimpleHTTPRequestHandler):
    # Header biar hasil nmap/curl kelihatan seperti server PHP biasa.
    server_version = "Apache/2.4.41 (Ubuntu)"
    sys_version = ""

    def end_headers(self):
        self.send_header("X-Powered-By", "PHP/7.4.3")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        super().end_headers()

    def version_string(self):
        return self.server_version

    # ---- util
    def cookies(self):
        out = {}
        for part in self.headers.get("Cookie", "").split(";"):
            if "=" in part:
                k, v = part.split("=", 1)
                out[k.strip()] = v.strip()
        return out

    def current_user(self):
        token = self.cookies().get("PHPSESSID")
        username = SESSIONS.get(token) if token else None
        if not username:
            # SENGAJA: cookie "user" dipercaya apa adanya (jalur cadangan demo).
            username = self.cookies().get("user")
        if not username:
            return None
        conn = db()
        try:
            row = conn.execute(
                "SELECT username, role, label, email FROM users WHERE username = ?",
                (username,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def read_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return None

    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self._send_cookies()
        self.end_headers()
        self.wfile.write(data)

    def send_html(self, body, status=200):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self._send_cookies()
        self.end_headers()
        self.wfile.write(data)

    def _send_cookies(self):
        for c in getattr(self, "_cookies", []):
            self.send_header("Set-Cookie", c)

    def start_session(self, username):
        token = secrets.token_hex(16)
        SESSIONS[token] = username
        # SENGAJA tanpa HttpOnly: cookie bisa dibaca JavaScript (stored XSS).
        self._cookies.append("PHPSESSID=%s; Path=/" % token)
        self._cookies.append("user=%s; Path=/" % username)

    def clear_session(self):
        token = self.cookies().get("PHPSESSID")
        SESSIONS.pop(token, None)
        self._cookies.append("PHPSESSID=; Path=/; Max-Age=0")
        self._cookies.append("user=; Path=/; Max-Age=0")

    # ---- GET
    def do_GET(self):
        self._cookies = []
        url = urllib.parse.urlparse(self.path)
        path, query = url.path, urllib.parse.parse_qs(url.query)

        if path == "/api/me":
            return self.send_json({"user": self.current_user()})

        if path == "/api/reviews":
            pid = int((query.get("pid") or ["1"])[0])
            conn = db()
            try:
                rows = conn.execute(
                    "SELECT id, pid, author, text FROM reviews WHERE pid = ? ORDER BY id ASC",
                    (pid,),
                ).fetchall()
            finally:
                conn.close()
            return self.send_json({"reviews": [dict(r) for r in rows]})

        if path == "/api/prices":
            conn = db()
            try:
                rows = conn.execute("SELECT product_id, price FROM product_prices").fetchall()
            finally:
                conn.close()
            return self.send_json({"prices": {str(r["product_id"]): r["price"] for r in rows}})

        if path == "/api/orders/mine":
            user = self.current_user()
            if not user:
                return self.send_json({"error": "Belum masuk."}, 401)
            conn = db()
            try:
                rows = conn.execute(
                    "SELECT * FROM orders WHERE owner = ? ORDER BY id ASC",
                    (user["username"],),
                ).fetchall()
            finally:
                conn.close()
            return self.send_json({"orders": [dict(r) for r in rows]})

        if path.startswith("/api/orders/"):
            # SENGAJA IDOR: tidak ada pengecekan pemilik pesanan.
            oid = urllib.parse.unquote(path[len("/api/orders/"):])
            conn = db()
            try:
                row = conn.execute(
                    "SELECT * FROM orders WHERE id = ?", (oid,)
                ).fetchone()
            finally:
                conn.close()
            if not row:
                return self.send_json({"error": "Pesanan tidak ditemukan."}, 404)
            return self.send_json(dict(row))

        if path == "/api/seller/summary":
            user = self.current_user()
            if not user or user["role"] != "admin":
                return self.send_json({"error": "Khusus penjual."}, 403)
            conn = db()
            try:
                orders = [dict(r) for r in conn.execute(
                    "SELECT * FROM orders ORDER BY id DESC"
                ).fetchall()]
                reviews = conn.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
                store = get_setting(conn, "store_name", "TokoKita Official Store")
            finally:
                conn.close()
            return self.send_json({"orders": orders, "reviews": reviews, "storeName": store})

        if path == "/api/collect":
            # Endpoint "laptop penyerang": menampung cookie dari payload XSS.
            cookie = (query.get("c") or [""])[0]
            if cookie and len(STOLEN) < 50:
                STOLEN.append({
                    "cookie": cookie,
                    "time": datetime.datetime.now().strftime("%H:%M:%S"),
                    "ip": self.client_address[0],
                })
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Content-Length", str(len(ONE_PIXEL_GIF)))
            self.end_headers()
            self.wfile.write(ONE_PIXEL_GIF)
            return

        if path == "/collector":
            return self.send_html(collector_page())

        if path.startswith("/uploads/"):
            return self.serve_upload(path, query)

        if path.endswith((".py", ".db")) or path.startswith(("/tasks/", "/tests/", "/.git")):
            return self.send_error(404)

        return super().do_GET()

    # ---- POST
    def do_POST(self):
        self._cookies = []
        url = urllib.parse.urlparse(self.path)
        path, query = url.path, urllib.parse.parse_qs(url.query)

        if path == "/api/login":
            return self.api_login()
        if path == "/api/register":
            return self.api_register()
        if path == "/api/logout":
            self.clear_session()
            return self.send_json({"ok": True})
        if path == "/api/reviews":
            return self.api_post_review()
        if path == "/api/checkout":
            return self.api_checkout()
        if path == "/api/seller/store":
            return self.api_store_name()
        if path == "/api/seller/price":
            return self.api_price()
        if path == "/api/seller/reset":
            return self.api_reset()
        if path == "/api/upload":
            return self.api_upload(query)

        return self.send_json({"error": "Endpoint tidak ada."}, 404)

    # ---- auth
    def api_login(self):
        data = self.read_json() or {}
        identifier = str(data.get("identifier") or "").strip()
        password = str(data.get("password") or "")
        if not identifier or not password:
            return self.send_json({"error": "Isi username/email dan kata sandi dulu."}, 400)

        conn = db()
        try:
            username = identifier
            if "@" in identifier:
                row = conn.execute(
                    "SELECT username FROM users WHERE email = '%s'" % identifier
                ).fetchone()
                if row:
                    username = row["username"]
            # SENGAJA SQL injection: input disambung langsung ke query.
            sql = (
                "SELECT username, role, label, email FROM users "
                "WHERE password = '%s' AND username = '%s'" % (password, username)
            )
            row = conn.execute(sql).fetchone()
        except sqlite3.Error as exc:
            return self.send_json({"error": "SQL error: %s" % exc}, 500)
        finally:
            conn.close()

        if not row:
            return self.send_json({"error": "Username/email atau kata sandi salah."}, 401)
        self.start_session(row["username"])
        return self.send_json({"ok": True, "user": dict(row)})

    def api_register(self):
        data = self.read_json() or {}
        name = str(data.get("name") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        password = str(data.get("password") or "")
        if not name or not email or not password:
            return self.send_json({"error": "Semua field wajib diisi."}, 400)
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
            return self.send_json({"error": "Format email tidak valid."}, 400)
        if len(password) < 6:
            return self.send_json({"error": "Kata sandi minimal 6 karakter."}, 400)

        base = re.sub(r"[^a-z0-9_]+", "_", email.split("@")[0]).strip("_") or "pengguna"
        conn = db()
        try:
            if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
                return self.send_json({"error": "Email sudah terdaftar."}, 409)
            username, n = base, 2
            while conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
                username = base + str(n)
                n += 1
            conn.execute(
                "INSERT INTO users(username, password, role, label, email) VALUES (?,?,?,?,?)",
                (username, password, "user", name, email),
            )
            conn.commit()
            row = conn.execute(
                "SELECT username, role, label, email FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        finally:
            conn.close()
        self.start_session(row["username"])
        return self.send_json({"ok": True, "user": dict(row)})

    # ---- ulasan (stored XSS)
    def api_post_review(self):
        data = self.read_json() or {}
        try:
            pid = int(data.get("pid"))
        except (TypeError, ValueError):
            return self.send_json({"error": "Produk tidak valid."}, 400)
        author = str(data.get("author") or "Anonim")
        text = str(data.get("text") or "")
        if not text:
            return self.send_json({"error": "Ulasan masih kosong."}, 400)
        conn = db()
        try:
            # SENGAJA: teks disimpan mentah, nanti dirender tanpa escape.
            conn.execute(
                "INSERT INTO reviews(pid, author, text, created) VALUES (?,?,?,?)",
                (pid, author, text, datetime.datetime.now().isoformat(timespec="seconds")),
            )
            conn.commit()
        finally:
            conn.close()
        return self.send_json({"ok": True})

    # ---- checkout (harga dari client) & IDOR
    def api_checkout(self):
        data = self.read_json() or {}
        items = data.get("items")
        if not isinstance(items, list) or not items:
            return self.send_json({"error": "Keranjang kosong."}, 400)

        total, names = 0, []
        for it in items:
            try:
                price = int(it.get("price") or 0)   # SENGAJA: percaya harga client
                qty = int(it.get("qty") or 1)
            except (TypeError, ValueError):
                return self.send_json({"error": "Data keranjang tidak valid."}, 400)
            total += price * qty
            names.append(str(it.get("name") or "Produk"))

        user = self.current_user()
        owner = user["username"] if user else "tamu"
        label = user["label"] if user else "Tamu"
        item_text = names[0] + (" +%d produk lain" % (len(names) - 1) if len(names) > 1 else "")

        conn = db()
        try:
            new_id = max(301, (conn.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 300) + 1)
            conn.execute(
                "INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)",
                (new_id, owner, item_text, total, label, "Alamat sesuai profil", "-", "Dikemas"),
            )
            conn.commit()
        finally:
            conn.close()
        return self.send_json({"ok": True, "id": new_id, "total": total})

    # ---- penjual
    def api_store_name(self):
        user = self.current_user()
        if not user or user["role"] != "admin":
            return self.send_json({"error": "Khusus penjual."}, 403)
        data = self.read_json() or {}
        name = str(data.get("name") or "").strip()
        if not name:
            return self.send_json({"error": "Nama toko kosong."}, 400)
        conn = db()
        try:
            conn.execute("UPDATE settings SET value = ? WHERE key = 'store_name'", (name,))
            conn.commit()
        finally:
            conn.close()
        return self.send_json({"ok": True, "name": name})

    def api_price(self):
        user = self.current_user()
        if not user or user["role"] != "admin":
            return self.send_json({"error": "Khusus penjual."}, 403)
        data = self.read_json() or {}
        try:
            pid = int(data.get("id"))
            price = int(data.get("price"))
        except (TypeError, ValueError):
            return self.send_json({"error": "Harga tidak valid."}, 400)
        if price < 0:
            return self.send_json({"error": "Harga tidak valid."}, 400)
        conn = db()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO product_prices(product_id, price) VALUES (?, ?)",
                (pid, price),
            )
            conn.commit()
        finally:
            conn.close()
        return self.send_json({"ok": True, "id": pid, "price": price})

    def api_reset(self):
        user = self.current_user()
        if not user or user["role"] != "admin":
            return self.send_json({"error": "Khusus penjual."}, 403)
        conn = db()
        try:
            conn.execute("DELETE FROM reviews")
            now = datetime.datetime.now().isoformat(timespec="seconds")
            conn.executemany(
                "INSERT INTO reviews(pid, author, text, created) VALUES (?,?,?,?)",
                [(pid, author, text, now) for pid, author, text in SEED_REVIEWS],
            )
            conn.execute("DELETE FROM orders WHERE id >= 301")
            conn.execute("DELETE FROM product_prices")
            conn.execute(
                "UPDATE settings SET value = 'TokoKita Official Store' WHERE key = 'store_name'"
            )
            conn.commit()
        finally:
            conn.close()
        return self.send_json({"ok": True})

    # ---- upload (tanpa validasi ekstensi)
    def api_upload(self, query):
        name = os.path.basename((query.get("name") or ["upload.bin"])[0]) or "upload.bin"
        n = int(self.headers.get("Content-Length") or 0)
        payload = self.rfile.read(n)
        os.makedirs(UPLOADS, exist_ok=True)
        with open(os.path.join(UPLOADS, name), "wb") as fh:
            fh.write(payload)
        return self.send_json({"ok": True, "url": "/uploads/" + urllib.parse.quote(name)})

    # ---- file upload & shell simulasi
    def serve_upload(self, path, query):
        name = os.path.basename(urllib.parse.unquote(path[len("/uploads/"):]))
        full = os.path.join(UPLOADS, name)
        if name.lower().endswith(".php"):
            if not os.path.isfile(full):
                return self.send_error(404)
            cmd = (query.get("cmd") or ["whoami"])[0]
            return self.send_html(fake_shell(cmd))
        if not os.path.isfile(full):
            return self.send_error(404)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as fh:
            data = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


# ---------------------------------------------------------------- halaman
def fake_shell(cmd):
    cmd = cmd.strip()[:200]
    output = SHELL_OUTPUTS.get(cmd, "sh: 1: %s: not found" % cmd)
    return """<!doctype html><html><head><meta charset="utf-8">
<title>Shell — /uploads/shell.php</title>
<style>body{background:#0b0f0c;color:#7dff9b;font:14px/1.5 monospace;padding:24px}
pre{white-space:pre-wrap}form{margin-bottom:18px}input{background:#111;color:#7dff9b;border:1px solid #2c4;padding:8px;width:60%%}
button{background:#2c4;border:0;padding:8px 14px;cursor:pointer}</style></head><body>
<h3>PHP Shell v1.0 — uid=33(www-data)</h3>
<form method="get"><input name="cmd" value="%s" autofocus><button>Jalankan</button></form>
<pre>$ %s
%s</pre>
<p style="color:#4a7">simulasi lab — tidak ada perintah nyata yang dijalankan</p>
</body></html>""" % (html.escape(cmd), html.escape(cmd), html.escape(output))


def collector_page():
    rows = "".join(
        "<tr><td>%s</td><td>%s</td><td><code>%s</code></td></tr>"
        % (html.escape(s["time"]), html.escape(s["ip"]), html.escape(s["cookie"]))
        for s in reversed(STOLEN)
    ) or '<tr><td colspan="3">Belum ada cookie masuk. Tunggu korban membuka ulasan.</td></tr>'
    return """<!doctype html><html><head><meta charset="utf-8">
<title>Collector — cookie masuk</title>
<style>body{background:#111;color:#eee;font:14px/1.6 system-ui;padding:24px;max-width:900px;margin:auto}
table{width:100%%;border-collapse:collapse}td,th{border-bottom:1px solid #333;padding:10px;text-align:left;vertical-align:top}
code{color:#7dff9b;word-break:break-all}h1{font-size:20px}</style></head><body>
<h1>Collector — cookie masuk</h1>
<p>Halaman ini berperan sebagai "laptop penyerang". Tempel nilai cookie yang masuk
ke DevTools browser (Application / Storage → Cookies) lalu reload TokoKita.</p>
<table><tr><th>Jam</th><th>IP</th><th>Cookie</th></tr>%s</table>
<p><a style="color:#7dff9b" href="/">&larr; balik ke toko</a> ·
<a style="color:#7dff9b" href="/collector">refresh</a></p>
</body></html>""" % rows


def main():
    parser = argparse.ArgumentParser(description="TokoKita — server lab rentan")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    os.makedirs(UPLOADS, exist_ok=True)
    init_db()

    print("=" * 62)
    print("  TokoKita — LAB RENTAN. Hanya untuk latihan/demo lokal.")
    print("  Jangan buka ke internet. Bind: %s:%d" % (args.host, args.port))
    print("  Toko     : http://%s:%d/" % (args.host, args.port))
    print("  Collector: http://%s:%d/collector" % (args.host, args.port))
    print("=" * 62)
    sys.stdout.flush()

    httpd = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=ROOT))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")


if __name__ == "__main__":
    main()
