/* TokoKita — auth.js
   Register / login / logout / sesi lewat backend (server.py).
   Server yang menyimpan akun dan cookie sesi; browser hanya menyimpan
   objek user yang sedang login di memori. */

var currentUser = null;

/* Pembungkus fetch JSON. Body ada = POST, tidak ada = GET. */
function api(path, body) {
  var opt = {method: body ? "POST" : "GET", credentials: "same-origin"};
  if (body) {
    opt.headers = {"Content-Type": "application/json"};
    opt.body = JSON.stringify(body);
  }
  return fetch(path, opt).then(function (r) {
    return r.json().catch(function () {
      return {error: "Respons server tidak valid (" + r.status + ")."};
    });
  });
}

function startSession(user) {
  currentUser = user;
  updateUserUI();
}

function restoreSession() {
  return api("/api/me").then(function (res) {
    if (res && res.user) startSession(res.user);
    else updateUserUI();
  });
}

function logout() {
  currentUser = null;
  updateUserUI();
  api("/api/logout", {}).then(function () {
    toast("Kamu sudah keluar. Sampai jumpa!");
    go("index.html");
  });
}

/* ---------- tampilan header: nama user harus selalu terlihat ---------- */
function updateUserUI() {
  var chip = document.getElementById("userChip");
  if (!chip) return;
  var base = window.TOKOKITA_BASE || "";
  if (currentUser) {
    chip.innerHTML =
      '<div class="avatar">' + esc(currentUser.label.charAt(0)) + '</div>' +
      '<div style="line-height:1.25"><div style="font-weight:700;font-size:14px">' + esc(currentUser.label) + '</div>' +
      '<div class="small" style="font-size:12px">' + (currentUser.role === "admin" ? "Penjual • Official Store" : "Pembeli") + '</div></div>' +
      (currentUser.role === "admin"
        ? '<a class="btn btn-ghost btn-sm" href="' + base + 'pages/seller.html">Dashboard Penjual</a>'
        : '<a class="btn btn-outline btn-sm" href="' + base + 'pages/profile.html">Profil</a>') +
      '<button class="btn btn-outline btn-sm" type="button" onclick="logout()">Keluar</button>';
  } else {
    chip.innerHTML =
      '<a class="btn btn-outline btn-sm" href="' + base + 'pages/profile.html">Profil</a>' +
      '<a class="btn btn-outline btn-sm" href="' + base + 'pages/register.html">Daftar</a>' +
      '<a class="btn btn-brand btn-sm" href="' + base + 'pages/login.html">Masuk</a>';
  }
  var pa = document.getElementById("profileAvatar");
  if (pa && currentUser) pa.textContent = currentUser.label.charAt(0);
}

/* ---------- register & login ---------- */
function doRegister(e) {
  e.preventDefault();
  var name = document.getElementById("regName").value.trim();
  var email = document.getElementById("regEmail").value.trim();
  var p1 = document.getElementById("regPass").value;
  var p2 = document.getElementById("regPass2").value;
  var res = document.getElementById("regResult");
  function fail(msg) { res.innerHTML = '<div class="alert alert-err">' + msg + "</div>"; return false; }
  if (!name || !email || !p1 || !p2) return fail("<b>Pendaftaran gagal.</b> Semua field wajib diisi: nama, email, dan kata sandi.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("<b>Pendaftaran gagal.</b> Format email tidak valid — contoh yang benar: nama@email.com.");
  if (p1.length < 6) return fail("<b>Pendaftaran gagal.</b> Kata sandi minimal 6 karakter — kata sandimu baru " + p1.length + " karakter.");
  if (p1 !== p2) return fail("<b>Pendaftaran gagal.</b> Ulangi kata sandi tidak sama dengan kata sandi pertama.");

  api("/api/register", {name: name, email: email, password: p1}).then(function (r) {
    if (r.error) { fail("<b>Pendaftaran gagal.</b> " + esc(r.error)); return; }
    startSession(r.user);
    res.innerHTML = '<div class="alert alert-ok"><b>Pendaftaran berhasil!</b> Selamat datang, ' + esc(r.user.label) + ". Akunmu (" + esc(r.user.email) + ") sudah aktif dan kamu sudah masuk.</div>";
    toast("Selamat datang, " + r.user.label);
    document.getElementById("regPass").value = "";
    document.getElementById("regPass2").value = "";
    setTimeout(function () { go("index.html"); }, 900);
  });
  return false;
}

function doLogin(e) {
  e.preventDefault();
  var u = document.getElementById("loginUser").value.trim();
  var p = document.getElementById("loginPass").value;
  var res = document.getElementById("loginResult");
  if (!u || !p) { res.innerHTML = '<div class="alert alert-err">Isi username/email dan kata sandi dulu, lalu coba lagi.</div>'; return false; }
  res.innerHTML = '<p class="small">Memeriksa…</p>';
  api("/api/login", {identifier: u, password: p}).then(function (r) {
    if (r.error) {
      res.innerHTML = '<div class="alert alert-err">' + esc(r.error) + "</div>";
      return;
    }
    startSession(r.user);
    res.innerHTML = '<div class="alert alert-ok"><b>Selamat datang kembali, ' + esc(r.user.label) + "!</b></div>";
    toast("Selamat datang, " + r.user.label);
    setTimeout(function () { go("index.html"); }, 700);
  });
  return false;
}
