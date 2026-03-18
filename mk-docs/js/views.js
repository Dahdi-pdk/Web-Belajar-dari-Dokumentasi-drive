/**
 * views.js
 * ────────
 * Mengatur perpindahan antar view/halaman dan breadcrumb navigasi.
 *
 * View yang tersedia:
 *  login, folders, files, explanation, editor, account, history
 */

/**
 * Tampilkan view tertentu dan sembunyikan yang lain.
 * @param {string} name - nama view (tanpa prefix 'view-')
 */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Render ulang breadcrumb di header dan sidebar berdasarkan state.breadcrumb.
 * Tiap item breadcrumb berupa { id, name, view }.
 */
function updateBreadcrumb() {
  const nav = document.getElementById('breadcrumb');
  nav.innerHTML = '';

  // Item Home
  const home = document.createElement('span');
  home.className = 'bc-item';
  home.textContent = '🏠 Home';
  home.onclick = () => {
    state.breadcrumb = [];
    updateBreadcrumb();
    renderFolders();
    setActiveNav('sb-nav-home');
  };
  nav.appendChild(home);

  state.breadcrumb.forEach((item, i) => {
    const sep = document.createElement('span');
    sep.className = 'bc-sep';
    sep.textContent = '›';
    nav.appendChild(sep);

    const crumb = document.createElement('span');
    const isLast = i === state.breadcrumb.length - 1;
    crumb.className = `bc-item${isLast ? ' current' : ''}`;
    crumb.textContent = item.name;
    if (!isLast) {
      crumb.onclick = () => {
        state.breadcrumb = state.breadcrumb.slice(0, i + 1);
        updateBreadcrumb();
        if (item.view === 'files') openFolder(item.id, item.name, false);
        else showView(item.view || 'folders');
      };
    }
    nav.appendChild(crumb);
  });

  // Sync sidebar breadcrumb
  updateSidebarBreadcrumb();
}
