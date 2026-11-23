/* TokoKita — app.js
   Logika toko: katalog, detail produk, ulasan, pencarian, keranjang,
   checkout, pesanan, profil, dan dashboard penjual.
   Dipakai di semua halaman; setiap halaman hanya menjalankan init
   untuk elemen yang ada di halaman itu. */

function fmt(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
function esc(s) { var d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; }
function go(path) { window.location.href = (window.TOKOKITA_BASE || "") + path; }
function imgSrc(p) { return (window.TOKOKITA_BASE || "") + p.img; }
function toast(msg) {
  var t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(function () { t.classList.remove("show"); }, 3200);
}
function $(id) { return document.getElementById(id); }

/* Gambar produk: foto asli (p.img) untuk 6 produk pertama, sisanya
   ilustrasi SVG per jenis barang (p.art) — bukan blok placeholder abu-abu. */
var ARTS = {
  laptop: '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="55" y="45" width="230" height="140" rx="8" fill="#1A1714"/><rect x="68" y="58" width="204" height="114" rx="4" fill="#F7F1E8"/><rect x="30" y="185" width="280" height="12" rx="6" fill="#4A443D"/></svg>',
  phone: '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="130" y="20" width="80" height="180" rx="16" fill="#1A1714"/><rect x="140" y="32" width="60" height="148" rx="8" fill="#F7F1E8"/><circle cx="170" cy="190" r="4" fill="#9C4A26"/></svg>',
  headphone: '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M95 175 C88 80 140 48 170 48 C200 48 252 80 245 175 L222 175 C226 95 200 70 170 70 C140 70 114 95 118 175 Z" fill="#1A1714"/><rect x="80" y="150" width="34" height="52" rx="16" fill="#2B2622"/><rect x="226" y="150" width="34" height="52" rx="16" fill="#2B2622"/></svg>',
  shoe: '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M60 150 L110 95 Q130 78 155 88 L250 130 Q285 145 280 165 L275 175 L60 175 Z" fill="#FFFDF8" stroke="#1A1714" stroke-width="3"/><path d="M60 175 L280 175 L280 185 L60 185 Z" fill="#9C4A26"/></svg>',
  keyboard: '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="40" y="70" width="260" height="90" rx="10" fill="#1A1714"/><g fill="#F7F1E8"><rect x="56" y="84" width="34" height="24" rx="4"/><rect x="98" y="84" width="34" height="24" rx="4"/><rect x="140" y="84" width="34" height="24" rx="4"/><rect x="182" y="84" width="34" height="24" rx="4"/><rect x="224" y="84" width="34" height="24" rx="4"/><rect x="56" y="116" width="34" height="24" rx="4"/><rect x="98" y="116" width="34" height="24" rx="4"/><rect x="140" y="116" width="118" height="24" rx="4"/></g></svg>',
  bag: '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M110 70 L110 190 Q110 200 120 200 L220 200 Q230 200 230 190 L230 70 Q230 55 215 55 L125 55 Q110 55 110 70 Z" fill="#2B2622"/><path d="M145 55 L145 40 Q145 28 170 28 Q195 28 195 40 L195 55" fill="none" stroke="#1A1714" stroke-width="8"/><rect x="150" y="105" width="40" height="50" rx="6" fill="#9C4A26"/></svg>'
};
function productImageHTML(p) {
  if (p.img) return '<img src="' + imgSrc(p) + '" alt="' + esc(p.name) + '" loading="lazy">';
  return ARTS[p.art || "bag"] || ARTS.bag;
}

/* ---------- state yang persisten ---------- */
var cart = [];
var currentProduct = 1, qty = 1, activeCat = "semua";

function loadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return fallback;
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function loadShopState() {
  /* Keranjang tetap di browser; pesanan & ulasan disimpan server. */
  cart = loadJSON("tokokita_cart", []);
}
/* Harga hasil edit penjual disimpan server; terapkan ke katalog. */
function loadPrices() {
  return api("/api/prices").then(function (res) {
    var prices = (res && res.prices) || {};
    PRODUCTS.forEach(function (p) {
      if (prices[p.id] !== undefined) p.price = prices[p.id];
    });
  });
}

/* ---------- katalog ---------- */
function renderCats() {
  var bar = $("catBar");
  if (!bar) return;
  bar.innerHTML = '<ul class="cat-list">' + CATS.map(function (c) {
    return '<li><button type="button" class="chip' + (activeCat === c[0] ? " active" : "") + '" onclick="filterCat(\'' + c[0] + '\')">' + c[1] + "</button></li>";
  }).join("") + "</ul>";
}
function filterCat(c) {
  activeCat = c;
  renderCats();
  renderProducts();
  var k = $("katalog");
  if (k) k.scrollIntoView({behavior: "smooth"});
}
function discPct(p) { return Math.round((1 - p.price / p.old) * 100); }
function shortDesc(p) { var d = p.desc, i = d.indexOf(". "); return i > 0 ? d.slice(0, i + 1) : d; }
function productCard(p) {
  return '<article class="pcard" onclick="selectProduct(' + p.id + ')">' +
    '<div class="ph">' + productImageHTML(p) + '</div>' +
    '<div class="pb"><div class="pcat">' + esc(CATLABEL[p.cat] || p.cat) + '</div>' +
    '<div class="pname">' + esc(p.name) + '</div>' +
    '<p class="pdesc">' + esc(shortDesc(p)) + '</p>' +
    '<div class="pmeta"><span class="star">★ ' + p.rating + '</span> &nbsp;·&nbsp; Terjual ' + p.sold + ' &nbsp;·&nbsp; ' + esc(p.city) + '</div>' +
    '<div class="small" style="margin:-8px 0 12px">Toko ' + esc(p.store) + ' • ' + esc(p.city) + '</div>' +
    '<div class="pfoot"><span><span class="pprice">' + fmt(p.price) + '</span> <span class="pold">' + fmt(p.old) + '</span> <span class="disc">−' + discPct(p) + '%</span></span>' +
    '<button class="add-btn" type="button" onclick="event.stopPropagation();addOne(' + p.id + ')">+ Keranjang</button></div></div></article>';
}
function renderProducts() {
  var grid = $("productGrid");
  if (!grid) return;
  var list = PRODUCTS.filter(function (p) { return activeCat === "semua" || p.cat === activeCat; });
  grid.innerHTML = list.map(productCard).join("") || '<p class="small">Belum ada produk di kategori ini.</p>';
  var lc = $("listCount");
  if (lc) lc.textContent = list.length + " produk";
}
function selectProduct(id) { go("pages/product.html?id=" + id); }
function chQty(d) {
  qty = Math.max(1, qty + d);
  var el = $("qtyVal");
  if (el) el.textContent = qty;
}
function renderProductDetail() {
  var params = new URLSearchParams(window.location.search);
  var id = parseInt(params.get("id") || "1", 10);
  var p = PRODUCTS.find(function (x) { return x.id === id; }) || PRODUCTS[0];
  currentProduct = p.id; qty = 1;
  if ($("crumbName")) $("crumbName").textContent = p.name;
  var im = $("pdImg"); if (im) { if (p.img) { im.src = imgSrc(p); im.alt = p.name; } }
  var imWrap = $("pdImgWrap"); if (imWrap && !p.img) { imWrap.innerHTML = productImageHTML(p); }
  if ($("pdName")) $("pdName").textContent = p.name;
  if ($("pdMeta")) $("pdMeta").innerHTML = '<span style="color:var(--terra);font-weight:700">★</span> ' + p.rating + ' • Terjual ' + p.sold + ' • Stok ' + p.stock + ' • Toko ' + esc(p.store) + ' • ' + esc(p.city);
  var sn = $("pdStoreName"); if (sn) sn.textContent = "Toko " + p.store;
  var sc = $("pdStoreCity"); if (sc) sc.textContent = "Dikelola oleh Toko " + p.store + " • " + p.city + " • Aktif 5 menit lalu";
  if ($("pdPrice")) $("pdPrice").textContent = fmt(p.price);
  if ($("pdOld")) $("pdOld").textContent = fmt(p.old);
  if ($("pdDisc")) $("pdDisc").textContent = "−" + discPct(p) + "%";
  if ($("pdDesc")) $("pdDesc").textContent = p.desc;
  if ($("qtyVal")) $("qtyVal").textContent = "1";
  if ($("pdStock")) $("pdStock").textContent = "Stok tersedia: " + p.stock;
  renderReviews();
}

/* ---------- ulasan ---------- */
function renderReviews() {
  var listEl = $("reviewList");
  if (!listEl) return;
  api("/api/reviews?pid=" + currentProduct).then(function (res) {
    var list = (res && res.reviews) || [];
    /* Sengaja rentan: author & text dirender tanpa esc() → stored XSS. */
    listEl.innerHTML = list.map(function (r) {
      return '<div class="review"><b>' + r.author + '</b> <span style="color:var(--terra)">★★★★★</span> <span class="small">• Pembelian terverifikasi</span><div style="margin-top:4px">' + r.text + "</div></div>";
    }).join("") || '<p class="small">Belum ada ulasan untuk produk ini.</p>';
  });
}
function postReview(e) {
  e.preventDefault();
  api("/api/reviews", {pid: currentProduct, author: $("reviewName").value, text: $("reviewText").value}).then(function (res) {
    if (res.error) { toast(res.error); return; }
    $("reviewText").value = "";
    renderReviews();
    toast("Terima kasih! Ulasanmu sudah terbit.");
  });
  return false;
}

/* ---------- pencarian ---------- */
function doSearch(e) {
  e.preventDefault();
  var q = $("searchInput").value;
  var hit = PRODUCTS.filter(function (p) { return p.name.toLowerCase().indexOf(q.toLowerCase()) > -1; });
  var sr = $("searchResult");
  if (sr) sr.innerHTML = '<div class="alert alert-info">Hasil pencarian untuk: <b>' + esc(q) + "</b> — ditemukan " + hit.length + " produk.</div>";
  if (q) {
    activeCat = "semua"; renderCats();
    var grid = $("productGrid");
    if (grid) grid.innerHTML = hit.length ? hit.map(productCard).join("") : '<p class="small">Tidak ada produk yang cocok — coba kata kunci lain.</p>';
  }
  return false;
}

/* ---------- keranjang & pembayaran ---------- */
function addOne(id) { cart.push(id); saveJSON("tokokita_cart", cart); updateCartBadge(); toast("Produk ditambahkan ke keranjang"); }
function addToCart(id, buyNow) {
  for (var i = 0; i < qty; i++) cart.push(id);
  saveJSON("tokokita_cart", cart);
  updateCartBadge();
  toast("Produk ditambahkan ke keranjang");
  if (buyNow) go("pages/cart.html");
}
function updateCartBadge() {
  var b = $("cartBadge");
  if (!b) return;
  b.textContent = cart.length;
  b.style.display = cart.length ? "inline-flex" : "none";
}
function cartQty(id) { return cart.filter(function (x) { return x === id; }).length; }
function setQty(id, delta) {
  if (delta > 0) cart.push(id);
  else { var i = cart.indexOf(id); if (i > -1) cart.splice(i, 1); }
  saveJSON("tokokita_cart", cart);
  updateCartBadge();
  renderCart();
}
function renderCart() {
  var box = $("cartList");
  if (!box) return;
  if (!cart.length) {
    box.innerHTML = '<p class="small">Keranjangmu masih kosong. Yuk, mulai belanja!</p>';
    var pt = $("payTotal"); if (pt) pt.textContent = "Rp 0";
    return;
  }
  var ids = [];
  cart.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
  box.innerHTML = ids.map(function (id) {
    var p = PRODUCTS.find(function (x) { return x.id === id; });
    var q = cartQty(id);
    return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
      '<span style="width:72px;height:72px;flex:0 0 72px;display:block;overflow:hidden;border-radius:4px;border:1px solid var(--line)">' + productImageHTML(p) + '</span>' +
      '<div style="flex:1;min-width:160px"><div style="font-weight:600;font-size:14.5px">' + esc(p.name) + '</div>' +
      '<div class="pprice" style="font-size:17px">' + fmt(p.price) + '</div></div>' +
      '<div class="qty"><button type="button" onclick="setQty(' + id + ',-1)">−</button><span>' + q + '</span><button type="button" onclick="setQty(' + id + ',1)">+</button></div></div>';
  }).join("");
}
function renderCheckout() {
  var fields = $("checkoutFields");
  if (!fields) return;
  if (!cart.length) {
    fields.innerHTML = "";
    var pt0 = $("payTotal"); if (pt0) pt0.textContent = "Rp 0";
    return;
  }
  var ids = [];
  cart.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
  /* Rincian pembayaran dirender sebagai form; nilai harga ikut
     terkirim apa adanya saat pesanan dibuat. */
  fields.innerHTML = ids.map(function (id) {
    var p = PRODUCTS.find(function (x) { return x.id === id; });
    var q = cartQty(id);
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;gap:10px"><span class="small">' + esc(p.name.slice(0, 34)) + "… × " + q + '</span><b>' + fmt(p.price * q) + '</b></div>' +
      '<input type="hidden" name="item_price_' + id + '" id="priceField' + id + '" value="' + p.price + '">' +
      '<input type="hidden" name="item_qty_' + id + '" value="' + q + '">';
  }).join("");
  var total = 0;
  ids.forEach(function (id) { var p = PRODUCTS.find(function (x) { return x.id === id; }); total += p.price * cartQty(id); });
  var pt = $("payTotal"); if (pt) pt.textContent = fmt(total);
}
function doCheckout(e) {
  e.preventDefault();
  if (!cart.length) { toast("Keranjang masih kosong"); return false; }
  var ids = [];
  cart.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
  var items = ids.map(function (id) {
    var p = PRODUCTS.find(function (x) { return x.id === id; });
    var submitted = parseInt(document.getElementById("priceField" + id).value, 10);
    if (isNaN(submitted)) submitted = p.price;
    /* Sengaja rentan: harga dari hidden input dikirim dan dipercaya server. */
    return {id: id, name: p.name, price: submitted, qty: cartQty(id)};
  });
  api("/api/checkout", {items: items}).then(function (res) {
    if (res.error) { toast(res.error); return; }
    cart = []; saveJSON("tokokita_cart", cart);
    updateCartBadge();
    renderCart(); renderCheckout();
    var cr = $("checkoutResult");
    if (cr) cr.innerHTML = '<div class="alert alert-ok"><b>Pembayaran diterima — terima kasih!</b><br>Nomor pesanan: <b>#' + res.id + '</b><br>Total yang dibayar: <b>' + fmt(res.total) + '</b><br>Pesananmu sedang dikemas dan akan dikirim hari ini.</div>';
    toast("Pesanan #" + res.id + " berhasil dibuat");
  });
  return false;
}

/* ---------- pesanan ---------- */
function orderCard(id, o) {
  return '<div style="background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:16px;margin-top:12px"><h4 style="margin:0 0 8px;font-family:var(--serif);font-weight:400;font-size:18px">Pesanan #' + id + " — " + esc(o.item) + '</h4><table><tr><th style="width:130px">Penerima</th><td>' + esc(o.name) + '</td></tr><tr><th>Alamat</th><td>' + esc(o.addr) + '</td></tr><tr><th>No. HP</th><td>' + esc(o.phone) + '</td></tr><tr><th>Total</th><td><b>' + fmt(o.total) + '</b></td></tr><tr><th>Status</th><td>' + esc(o.status) + "</td></tr></table></div>";
}
function renderMyOrders() {
  var box = $("myOrders");
  if (!box) return;
  if (!currentUser) {
    box.innerHTML = '<p class="small">Masuk dulu untuk melihat riwayat pesananmu.</p><a class="btn btn-brand btn-sm" href="' + (window.TOKOKITA_BASE || "") + 'pages/login.html">Masuk</a>';
    return;
  }
  api("/api/orders/mine").then(function (res) {
    var mine = (res && res.orders) || [];
    box.innerHTML = mine.length ? mine.map(function (o) { return orderCard(o.id, o); }).join("") : '<p class="small">Kamu belum memiliki pesanan.</p>';
  });
}
function trackOrder() {
  var id = $("trackInput").value, box = $("trackResult");
  /* Sengaja rentan (IDOR): server tidak mengecek pemilik pesanan. */
  api("/api/orders/" + encodeURIComponent(id)).then(function (o) {
    if (!o || o.error) { box.innerHTML = '<div class="alert alert-info">Pesanan #' + esc(String(id)) + " tidak ditemukan. Periksa kembali nomor pesananmu.</div>"; return; }
    box.innerHTML = orderCard(o.id, o);
  });
}

/* ---------- profil & unggahan ---------- */
function renderProfile() {
  var n = $("profileName"), r = $("profileRole");
  if (!n) return;
  if (currentUser) {
    n.textContent = currentUser.label;
    r.textContent = currentUser.role === "admin" ? "Penjual — TokoKita Official Store" : "Pembeli — " + (currentUser.email || "");
    $("pfName").value = currentUser.label;
    $("pfEmail").value = currentUser.email || (currentUser.username + "@tokokita.id");
  } else {
    n.textContent = "Pengunjung";
    r.textContent = "Belum masuk";
  }
}
function handleFile(input) {
  var box = $("uploadResult");
  if (!box || !input.files || !input.files[0]) return;
  var file = input.files[0];
  box.innerHTML = '<p class="small">Mengunggah ' + esc(file.name) + '…</p>';
  /* Sengaja rentan: server menerima file apa pun tanpa validasi ekstensi. */
  fetch("/api/upload?name=" + encodeURIComponent(file.name), {method: "POST", body: file})
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res.error) { box.innerHTML = '<div class="alert alert-err">' + esc(res.error) + "</div>"; return; }
      box.innerHTML = '<div class="alert alert-ok"><b>File terunggah.</b> ' + esc(file.name) + ' tersimpan di akunmu. <a href="' + res.url + '" target="_blank" rel="noopener">Lihat file</a></div>';
    });
}

/* ---------- dashboard penjual ---------- */
function renderSeller() {
  var gate = $("sellerGate"), panel = $("sellerPanel");
  if (!gate) return;
  if (!currentUser || currentUser.role !== "admin") {
    gate.innerHTML = '<div class="alert alert-info"><b>Halaman ini khusus penjual.</b> Masuk sebagai pemilik toko untuk membuka dashboard penjualan.</div><a class="btn btn-brand" href="' + (window.TOKOKITA_BASE || "") + 'pages/login.html">Masuk sebagai Penjual</a>';
    panel.style.display = "none";
    return;
  }
  api("/api/seller/summary").then(function (res) {
    if (res.error) { gate.innerHTML = '<div class="alert alert-err">' + esc(res.error) + "</div>"; return; }
    gate.innerHTML = '<div class="alert alert-ok">Kamu masuk sebagai <b>' + esc(currentUser.label) + '</b>, pemilik ' + esc(res.storeName) + '.</div>';
    panel.style.display = "block";
    if ($("storeNameLine")) $("storeNameLine").textContent = res.storeName;
    if ($("storeNameInput")) $("storeNameInput").value = res.storeName;
    $("statOrders").textContent = res.orders.length;
    $("statReviews").textContent = res.reviews + " ulasan";
    $("sellerOrders").innerHTML = "<tr><th>No. Pesanan</th><th>Pembeli</th><th>Produk</th><th>Total</th><th>Status</th></tr>" + res.orders.map(function (o) {
      return "<tr><td>#" + o.id + "</td><td>" + esc(o.name) + "</td><td>" + esc(o.item) + "</td><td><b>" + fmt(o.total) + "</b></td><td>" + esc(o.status) + "</td></tr>";
    }).join("");
    $("sellerProducts").innerHTML = "<tr><th>Produk</th><th>Harga (Rp)</th><th>Stok</th><th></th></tr>" + PRODUCTS.map(function (p) {
      return '<tr><td>' + esc(p.name.slice(0, 44)) + '…</td><td><input type="number" id="sp' + p.id + '" value="' + p.price + '" style="max-width:150px;min-height:38px"></td><td>' + p.stock + '</td><td><button class="btn btn-brand btn-sm" type="button" onclick="savePrice(' + p.id + ')">Simpan</button></td></tr>';
    }).join("");
  });
}
function savePrice(id) {
  var v = parseInt(document.getElementById("sp" + id).value, 10);
  if (isNaN(v) || v < 0) { toast("Harga tidak valid"); return; }
  var p = PRODUCTS.find(function (x) { return x.id === id; });
  api("/api/seller/price", {id: id, price: v}).then(function (res) {
    if (res.error) { toast(res.error); return; }
    p.price = v;
    renderProducts();
    toast("Harga " + p.name.slice(0, 26) + "… diperbarui jadi " + fmt(v));
  });
}
function saveStoreName() {
  var v = $("storeNameInput").value.trim();
  if (!v) return;
  api("/api/seller/store", {name: v}).then(function (res) {
    if (res.error) { $("storeNameResult").innerHTML = '<div class="alert alert-err">' + esc(res.error) + "</div>"; return; }
    document.querySelectorAll(".seller b").forEach(function (b) { if (b.textContent.indexOf("Store") > -1) b.textContent = v; });
    if ($("storeNameLine")) $("storeNameLine").textContent = v;
    $("storeNameResult").innerHTML = '<div class="alert alert-ok">Nama tampilan toko diperbarui menjadi <b>' + esc(v) + "</b>.</div>";
    toast("Nama toko diperbarui");
  });
}
function resetStore() {
  api("/api/seller/reset", {}).then(function (res) {
    if (res.error) { toast(res.error); return; }
    PRODUCTS.forEach(function (p) { if (p._orig) p.price = p._orig; });
    cart = []; saveJSON("tokokita_cart", cart);
    updateCartBadge();
    renderProducts(); renderSeller();
    toast("Data toko dipulihkan seperti semula");
  });
}

/* ---------- info ---------- */
function showInfo(key) {
  var p = INFO_PAGES[key] || INFO_PAGES.bantuan;
  if ($("infoTitle")) $("infoTitle").textContent = p[0];
  if ($("infoBody")) $("infoBody").innerHTML = p[1];
}

/* ---------- init per halaman ---------- */
document.addEventListener("DOMContentLoaded", function () {
  PRODUCTS.forEach(function (p) { p._orig = p.price; });
  loadShopState();
  updateCartBadge();
  var page = document.body.getAttribute("data-page") || "home";

  /* Tunggu sesi dari server selesai dimuat sebelum render halaman. */
  Promise.all([restoreSession(), loadPrices()]).then(function () {
    if (page === "home") {
      renderCats();
      renderProducts();
      /* Pencarian dari header halaman lain: index.html?q=kata */
      var qParam = new URLSearchParams(window.location.search).get("q");
      if (qParam) {
        var si0 = $("searchInput");
        if (si0) si0.value = qParam;
        var hit0 = PRODUCTS.filter(function (p) { return p.name.toLowerCase().indexOf(qParam.toLowerCase()) !== -1; });
        var sr0 = $("searchResult");
        if (sr0) sr0.innerHTML = '<div class="alert alert-info">Hasil pencarian untuk: <b>' + esc(qParam) + "</b> — ditemukan " + hit0.length + " produk.</div>";
        var grid0 = $("productGrid");
        if (grid0) grid0.innerHTML = hit0.length ? hit0.map(productCard).join("") : '<p class="small">Tidak ada produk yang cocok — coba kata kunci lain.</p>';
        var lc0 = $("listCount"); if (lc0) lc0.textContent = hit0.length + " produk";
      }
      var si = $("searchInput");
      if (si) si.addEventListener("input", function () {
        var q = si.value.trim().toLowerCase();
        var grid = $("productGrid");
        var hit = PRODUCTS.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
        if (grid) grid.innerHTML = hit.length ? hit.map(productCard).join("") : '<p class="small">Tidak ada produk yang cocok — coba kata kunci lain.</p>';
        var lc1 = $("listCount"); if (lc1) lc1.textContent = hit.length + " produk";
      });
      var sf = $("searchForm");
      if (sf) sf.addEventListener("submit", function (e) { e.preventDefault(); doSearch(e); });
    }
    if (page === "product") renderProductDetail();
    if (page === "cart") { renderCart(); }
    if (page === "checkout") { renderCart(); renderCheckout(); }
    if (page === "orders") {
      renderMyOrders();
      var oid = new URLSearchParams(window.location.search).get("id");
      if (oid && $("trackInput")) { $("trackInput").value = oid; trackOrder(); }
    }
    if (page === "profile") renderProfile();
    if (page === "seller") renderSeller();
    if (page === "info") {
      var params = new URLSearchParams(window.location.search);
      showInfo(params.get("page") || "bantuan");
    }
  });
});
