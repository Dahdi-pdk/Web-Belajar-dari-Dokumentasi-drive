/**
 * main.js
 * ───────
 * Entry point aplikasi. Dipanggil setelah DOMContentLoaded.
 *
 * Tanggung jawab:
 *  1. Wire semua event listener statik (tombol, keyboard, sidebar, modal)
 *  2. Panggil tryAutoLogin() untuk coba login otomatis dari sesi tersimpan
 *
 * URUTAN PEMUATAN SCRIPT (penting — setiap file bergantung pada yang di atasnya):
 *   config.js → state.js → utils.js → auth.js → api.js → database.js →
 *   views.js → folders.js → lightbox.js → slideshow.js → explanation.js →
 *   share.js → user.js → main.js
 */

/**
 * Fungsi utama inisialisasi — dipanggil satu kali saat DOM siap.
 */
function init() {
  log('App dimuat', 'info');
  if (window.location.protocol === 'file:')
    log('❌ Jalankan via web server (bukan file://)!', 'error');
  else
    log(`Origin: ${window.location.origin}`, 'info');

  // ── Login ──────────────────────────────────────────────────────
  document.getElementById('login-btn').addEventListener('click', requestAccessToken);

  // ── Lightbox ───────────────────────────────────────────────────
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-zoom-in').addEventListener('click',  () => lbZoom(0.12));
  document.getElementById('lb-zoom-out').addEventListener('click', () => lbZoom(-0.12));
  document.getElementById('lb-zoom-reset').addEventListener('click', () => {
    lb.scale = 1; lb.x = 0; lb.y = 0; applyLb(true);
  });

  // ── Slideshow ──────────────────────────────────────────────────
  document.getElementById('slideshow-btn').addEventListener('click', () => {
    const files = state.currentFolderFiles || [];
    if (!files.length) { toast('Tidak ada berkas', ''); return; }
    openSlideshow(files, 0);
  });

  // ── Editor ─────────────────────────────────────────────────────
  document.getElementById('editor-save-btn').addEventListener('click', saveExplanation);
  document.getElementById('editor-preview-btn').addEventListener('click', previewExplanation);

  // Add block main zone (tombol + di bawah semua blok)
  const mainZone = document.getElementById('main-add-zone');
  const mainMenu = document.getElementById('main-add-menu');
  mainZone.addEventListener('click', e => {
    if (!e.target.closest('.add-opt'))
      mainMenu.style.display = mainMenu.style.display === 'none' ? 'grid' : 'none';
  });

  // ── Share modal ────────────────────────────────────────────────
  document.getElementById('copy-link-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('share-link-input').value)
      .then(() => toast('✅ Link disalin!', 'ok'));
  });

  // ── Modal: tutup saat klik backdrop ───────────────────────────
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => { if (e.target === bd) bd.classList.remove('open'); });
  });

  // ── Debug toggle ───────────────────────────────────────────────
  document.getElementById('debug-toggle').addEventListener('click', () => {
    document.getElementById('debug-panel').classList.toggle('open');
  });

  // ── Keyboard shortcuts ─────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const lbOpen  = document.getElementById('lightbox').classList.contains('open');
    const slsOpen = document.getElementById('slideshow').classList.contains('open');

    if (e.key === 'Escape') {
      if      (lbOpen)            closeLightbox();
      else if (slsOpen)           closeSlideshow();
      else if (state.sidebarOpen) closeSidebar();
      else document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    }
    if (lbOpen) {
      if (e.key === '+' || e.key === '=') lbZoom(0.15);
      if (e.key === '-')                  lbZoom(-0.15);
      if (e.key === '0')                  { lb.scale = 1; lb.x = 0; lb.y = 0; applyLb(true); }
    }
    if (slsOpen) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ssGo(1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   ssGo(-1);
    }
  });

  // ── Burger / Sidebar ───────────────────────────────────────────
  document.getElementById('burger-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sb-close-btn').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // ── Sidebar nav ────────────────────────────────────────────────
  document.getElementById('sb-nav-home').addEventListener('click', () => {
    closeSidebar();
    state.breadcrumb = []; updateBreadcrumb(); renderFolders();
    setActiveNav('sb-nav-home');
  });
  document.getElementById('sb-nav-account').addEventListener('click', () => {
    setActiveNav('sb-nav-account'); openAccount();
  });
  document.getElementById('sb-nav-history').addEventListener('click', () => {
    setActiveNav('sb-nav-history'); openHistory();
  });
  document.getElementById('sb-nav-logout').addEventListener('click', logout);

  // Header avatar → halaman akun
  document.getElementById('header-avatar-btn').addEventListener('click', () => {
    setActiveNav('sb-nav-account'); openAccount();
  });

  // Halaman akun: tombol keluar
  document.getElementById('acct-logout-btn').addEventListener('click', logout);

  // Sidebar user row → halaman akun
  document.getElementById('sb-user-row').addEventListener('click', () => {
    setActiveNav('sb-nav-account'); openAccount();
  });

  // ── History filter ─────────────────────────────────────────────
  document.getElementById('hist-filter').addEventListener('click', e => {
    const btn = e.target.closest('.hist-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.hist-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderHistoryList(btn.dataset.f);
  });

  hideLoad();

  // ── Auto-login ─────────────────────────────────────────────────
  tryAutoLogin();
}

/**
 * Aktifkan item navigasi sidebar.
 * @param {string} id - ID elemen nav yang akan diaktifkan
 */
function setActiveNav(id) {
  document.querySelectorAll('.sb-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

/**
 * Dijalankan setelah login berhasil.
 * Urutan: ambil info user → muat database → tampilkan folder.
 */
async function onLoginSuccess() {
  document.getElementById('app-header').style.display = 'flex';
  showLoad('Menginisialisasi...');
  try {
    await fetchUserInfo();
    await loadDatabase();
    await renderFolders();
  } catch (e) {
    log(e.message, 'error');
    toast('❌ Gagal memuat aplikasi', 'err');
  }
  hideLoad();
}

/**
 * Coba login otomatis menggunakan sesi tersimpan di localStorage.
 * Hanya berjalan jika sesi disimpan dalam 7 hari terakhir.
 * Menggunakan silent request (tanpa popup) dengan hint email.
 */
function tryAutoLogin() {
  const saved = localStorage.getItem('mkdocs_session');
  if (!saved) return;
  try {
    const sess = JSON.parse(saved);
    if (Date.now() - sess.savedAt > 7 * 24 * 3600 * 1000) {
      localStorage.removeItem('mkdocs_session'); return;
    }
    log(`Mencoba auto-login sebagai ${sess.email}...`, 'info');
    // Tampilkan UI user sementara menunggu token
    state.user = { name: sess.name, email: sess.email, picture: sess.picture };
    if (!initTokenClient()) return;
    state.isSilentRefresh = false;
    state.authInProgress  = true;
    state.tokenClient.requestAccessToken({ prompt: '', hint: sess.email });
  } catch (_) {
    localStorage.removeItem('mkdocs_session');
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
