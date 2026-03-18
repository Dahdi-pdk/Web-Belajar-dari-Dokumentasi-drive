/**
 * user.js
 * ───────
 * Mengelola informasi pengguna, sidebar navigasi, halaman akun, dan halaman riwayat.
 *
 * Fungsi utama:
 *  fetchUserInfo()     — ambil profil Google setelah login, simpan ke localStorage
 *  updateUserUI()      — sinkronkan tampilan avatar/nama di header, sidebar, halaman akun
 *  openSidebar/close() — kontrol sidebar kiri (burger menu)
 *  openAccount()       — tampilkan halaman profil + statistik
 *  openHistory()       — tampilkan riwayat seluruh pengeditan
 */

// ═══════════════════════════════════════════════════════════════════
// USER INFO
// ═══════════════════════════════════════════════════════════════════

/**
 * Ambil informasi profil dari Google userinfo API.
 * Menyimpan sesi ke localStorage untuk auto-login berikutnya.
 */
async function fetchUserInfo() {
  try {
    const r    = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${state.accessToken}` },
    });
    const data = await r.json();
    state.user = { name: data.name, email: data.email, picture: data.picture, sub: data.sub };

    localStorage.setItem('mkdocs_session', JSON.stringify({
      email:   data.email,
      name:    data.name,
      picture: data.picture,
      savedAt: Date.now(),
    }));
    updateUserUI();
    log(`Login sebagai: ${data.email}`, 'success');
  } catch (e) {
    log(`Gagal ambil info user: ${e.message}`, 'warning');
  }
}

/**
 * Perbarui semua elemen UI yang menampilkan identitas user:
 * - Sidebar (avatar, nama, email)
 * - Header (avatar kecil)
 * - Halaman Akun (avatar besar, teks)
 */
function updateUserUI() {
  const u = state.user;
  if (!u) return;

  // Sidebar user row
  document.getElementById('sb-user-row').style.display = 'flex';
  document.getElementById('sb-user-name').textContent  = u.name || u.email;
  document.getElementById('sb-user-email').textContent = u.email;
  if (u.picture) {
    document.getElementById('sb-avatar').innerHTML =
      `<img src="${u.picture}" alt="${esc(u.name)}">`;
  }

  // Header avatar
  if (u.picture) {
    document.getElementById('header-avatar-btn').innerHTML =
      `<img src="${u.picture}" alt="${esc(u.name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  }

  // Halaman akun
  const acctAv = document.getElementById('acct-avatar');
  if (u.picture) acctAv.innerHTML = `<img src="${u.picture}" alt="${esc(u.name)}">`;
  document.getElementById('acct-name').textContent    = u.name  || '—';
  document.getElementById('acct-email').textContent   = u.email || '—';
  document.getElementById('acct-name-2').textContent  = u.name  || '—';
  document.getElementById('acct-email-2').textContent = u.email || '—';
  document.getElementById('acct-login-time').textContent =
    new Date().toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' });
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════

/** Buka sidebar + overlay */
function openSidebar() {
  state.sidebarOpen = true;
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
  document.getElementById('burger-btn').classList.add('open');
  updateSidebarBreadcrumb();
}

/** Tutup sidebar + overlay */
function closeSidebar() {
  state.sidebarOpen = false;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
  document.getElementById('burger-btn').classList.remove('open');
}

/** Toggle buka/tutup sidebar */
function toggleSidebar() { state.sidebarOpen ? closeSidebar() : openSidebar(); }

/**
 * Render breadcrumb navigasi di dalam sidebar.
 * Menampilkan jejak lokasi saat ini (Home → Folder → File → ...).
 */
function updateSidebarBreadcrumb() {
  const wrap = document.getElementById('sb-bc-wrap');
  const list = document.getElementById('sb-breadcrumb');
  if (!state.breadcrumb.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  list.innerHTML = '';

  const home       = document.createElement('div');
  home.className   = 'sb-bc-item';
  home.innerHTML   = '<span class="sb-bc-dot"></span>🏠 Beranda';
  home.onclick     = () => { closeSidebar(); state.breadcrumb = []; updateBreadcrumb(); renderFolders(); };
  list.appendChild(home);

  state.breadcrumb.forEach((item, i) => {
    const el      = document.createElement('div');
    const isLast  = i === state.breadcrumb.length - 1;
    el.className  = `sb-bc-item${isLast ? ' current' : ''}`;
    el.innerHTML  = `<span class="sb-bc-dot"></span>${esc(item.name)}`;
    if (!isLast) {
      el.onclick = () => {
        closeSidebar();
        state.breadcrumb = state.breadcrumb.slice(0, i + 1);
        updateBreadcrumb();
        if (item.view === 'files') openFolder(item.id, item.name);
        else showView(item.view || 'folders');
      };
    }
    list.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
// ACCOUNT VIEW
// ═══════════════════════════════════════════════════════════════════

/**
 * Buka halaman akun dan hitung statistik dari database.
 * Statistik: penjelasan dibuat oleh user ini, total edit, total file terdaftar.
 */
function openAccount() {
  closeSidebar();
  state.breadcrumb.push({ id: 'account', name: '👤 Akun', view: 'account' });
  updateBreadcrumb();

  const allEntries = Object.values(state.database);
  const myEntries  = allEntries.filter(e => e.createdBy === state.user?.email);
  const allHistory = allEntries.flatMap(e => e.history || []);
  const myEdits    = allHistory.filter(h => h.email === state.user?.email);

  document.getElementById('acct-stat-expl').textContent   = myEntries.length;
  document.getElementById('acct-stat-edit').textContent   = myEdits.length;
  document.getElementById('acct-stat-folder').textContent = Object.keys(state.database).length;
  showView('account');
}

// ═══════════════════════════════════════════════════════════════════
// HISTORY VIEW
// ═══════════════════════════════════════════════════════════════════

/** Buka halaman riwayat pengeditan global */
function openHistory() {
  closeSidebar();
  state.breadcrumb.push({ id: 'history', name: '📋 Riwayat', view: 'history' });
  updateBreadcrumb();
  renderHistoryList('all');
  showView('history');
}

/**
 * Render daftar riwayat dengan filter opsional.
 * @param {'all'|'create'|'edit'} filter
 */
function renderHistoryList(filter) {
  const list   = document.getElementById('hist-list');
  list.innerHTML = '';

  const allHistory = [];
  Object.values(state.database).forEach(entry => {
    (entry.history || []).forEach(h => {
      allHistory.push({ ...h, fileName: entry.fileName });
    });
  });

  allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filtered = filter === 'all'
    ? allHistory
    : allHistory.filter(h => h.action === filter);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty"><div class="empty-ico">📋</div><div class="empty-txt">Belum ada riwayat</div></div>`;
    return;
  }

  filtered.forEach(h => {
    const el          = document.createElement('div');
    el.className      = 'hist-entry';
    const actionLabel = h.action === 'create' ? 'Dibuat' : h.action === 'edit' ? 'Diedit' : h.action;
    const actionClass = h.action === 'edit' ? 'edit' : '';
    const avatarHtml  = h.picture ? `<img src="${esc(h.picture)}" alt="">` : (h.name?.[0] || '?');
    const timeStr     = h.timestamp
      ? new Date(h.timestamp).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' })
      : '—';
    el.innerHTML = `
      <div class="hist-avatar">${avatarHtml}</div>
      <div class="hist-body">
        <div class="hist-top">
          <span class="hist-user">${esc(h.name || h.email || 'Anonim')}</span>
          <span class="hist-action ${actionClass}">${actionLabel}</span>
        </div>
        <div class="hist-file">📄 ${esc(h.fileName || '—')}</div>
        <div class="hist-time">${esc(h.email || '')} • ${timeStr}</div>
      </div>`;
    list.appendChild(el);
  });
}
