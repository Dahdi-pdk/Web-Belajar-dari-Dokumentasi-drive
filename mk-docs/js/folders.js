/**
 * folders.js
 * ──────────
 * Mengelola tampilan grid folder (Mata Kuliah) dan grid file di dalam folder.
 * Juga berisi modal opsi yang muncul ketika user mengklik file/gambar.
 *
 * Alur:
 *  renderFolders()          → grid card folder dari FOLDER_1
 *    loadFolderThumb(id)    → ambil gambar pertama sebagai thumbnail (lazy)
 *  openFolder(id, name)     → grid file/gambar di dalam folder yang dipilih
 *    makeFileCard(file)     → satu card file, cek database untuk badge penjelasan
 *    showOptions(file)      → bottom-sheet modal dengan pilihan aksi
 */

// ── Folder grid ───────────────────────────────────────────────────

/** Render halaman utama: grid semua subfolder di FOLDER_1. */
async function renderFolders() {
  showLoad('Memuat folder...');
  showView('folders');
  updateBreadcrumb();
  const grid = document.getElementById('folders-grid');
  grid.innerHTML = '';

  try {
    const files   = await listFolder(CONFIG.FOLDER_1_ID);
    const folders = files.filter(f => isFld(f.mimeType));
    document.getElementById('folders-count').textContent = `${folders.length} folder`;

    if (!folders.length) {
      grid.innerHTML = `<div class="empty"><div class="empty-ico">📂</div><div class="empty-txt">Belum ada folder</div></div>`;
      hideLoad(); return;
    }

    const frag = document.createDocumentFragment();
    folders.forEach(folder => frag.appendChild(makeFolderCard(folder, () => {
      state.breadcrumb = [{ id: folder.id, name: folder.name, view: 'files' }];
      updateBreadcrumb();
      openFolder(folder.id, folder.name, true);
    })));
    grid.appendChild(frag);

    // Lazy-load thumbnail folder secara paralel, maks 5 sekaligus
    const BATCH = 5;
    for (let i = 0; i < folders.length; i += BATCH) {
      await Promise.allSettled(folders.slice(i, i + BATCH).map(f => loadFolderThumb(f.id)));
    }
  } catch (e) {
    log(e.message, 'error');
    grid.innerHTML = `<div class="empty"><div class="empty-ico">❌</div><div class="empty-txt">Gagal: ${esc(e.message)}</div></div>`;
  }
  hideLoad();
}

/**
 * Buat DOM element card folder.
 * @param {object} folder - metadata Drive
 * @param {Function} onClick
 */
function makeFolderCard(folder, onClick) {
  const card = document.createElement('div');
  card.className = 'folder-card';
  card.id = `fc-${folder.id}`;
  card.innerHTML = `
    <div class="f-thumb"><span class="f-thumb-icon">📁</span><div class="f-thumb-overlay"></div></div>
    <div class="f-info"><span class="f-name">${esc(folder.name)}</span></div>
  `;
  if (onClick) card.addEventListener('click', onClick);
  return card;
}

/**
 * Muat thumbnail folder (gambar pertama di dalamnya) secara async.
 * Memperbarui card yang sudah ada di DOM.
 * @param {string} folderId
 */
async function loadFolderThumb(folderId) {
  try {
    const files  = await listFolder(folderId);
    const images = files.filter(f => isImg(f.mimeType));
    const card   = document.getElementById(`fc-${folderId}`);
    if (!card) return;

    // Tambahkan badge jumlah foto
    const info  = card.querySelector('.f-info');
    const badge = document.createElement('span');
    badge.className   = 'f-count';
    badge.textContent = `${images.length} foto`;
    info.appendChild(badge);

    if (!images.length || !images[0].thumbnailLink) return;

    const thumbWrap = card.querySelector('.f-thumb');
    const icon      = thumbWrap.querySelector('.f-thumb-icon');
    const img       = document.createElement('img');
    img.src    = images[0].thumbnailLink;
    img.alt    = images[0].name;
    img.onload = () => icon.style.display = 'none';
    thumbWrap.insertBefore(img, thumbWrap.firstChild);
  } catch (e) {
    log(`Thumb ${folderId}: ${e.message}`, 'warning');
  }
}

// ── Files grid ────────────────────────────────────────────────────

/**
 * Buka folder dan tampilkan seluruh isinya dalam grid.
 * @param {string} folderId
 * @param {string} folderName
 */
async function openFolder(folderId, folderName) {
  showLoad(`Membuka ${folderName}...`);
  showView('files');
  document.getElementById('files-title').textContent = folderName;

  const grid = document.getElementById('files-grid');
  grid.innerHTML = '';

  // Tampilkan skeleton sementara data dimuat
  for (let i = 0; i < 8; i++) {
    const sk = document.createElement('div');
    sk.style.cssText = 'background:var(--surface);border-radius:var(--r);overflow:hidden;border:1px solid var(--border)';
    sk.innerHTML = `<div class="skel" style="height:165px"></div>
      <div style="padding:12px 14px">
        <div class="skel" style="height:13px;margin-bottom:7px"></div>
        <div class="skel" style="height:10px;width:55%"></div>
      </div>`;
    grid.appendChild(sk);
  }
  hideLoad();

  try {
    const files = await listFolder(folderId);
    grid.innerHTML = '';
    document.getElementById('files-count').textContent = `${files.length} berkas`;

    // Simpan file non-folder untuk fitur slideshow
    state.currentFolderFiles = files.filter(f => !isFld(f.mimeType));

    if (!files.length) {
      grid.innerHTML = `<div class="empty"><div class="empty-ico">📂</div><div class="empty-txt">Folder kosong</div></div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    files.forEach(file => {
      if (isFld(file.mimeType)) {
        const card = makeFolderCard(file, () => {
          state.breadcrumb.push({ id: file.id, name: file.name, view: 'files' });
          updateBreadcrumb();
          openFolder(file.id, file.name);
        });
        frag.appendChild(card);
      } else {
        frag.appendChild(makeFileCard(file));
      }
    });
    grid.appendChild(frag);

    // Lazy-load thumbnail subfolder
    files.filter(f => isFld(f.mimeType)).forEach(f => loadFolderThumb(f.id));

  } catch (e) {
    log(e.message, 'error');
    grid.innerHTML = `<div class="empty"><div class="empty-ico">❌</div><div class="empty-txt">${esc(e.message)}</div></div>`;
  }
}

/**
 * Buat DOM element card satu file.
 * Badge "Ada penjelasan" ditampilkan jika file terdaftar di database.
 * @param {object} file - metadata Drive
 */
function makeFileCard(file) {
  const hasExpl = !!dbGet(file.id);
  const card    = document.createElement('div');
  card.className = 'file-card';

  const thumb = document.createElement('div');
  thumb.className = 'fc-thumb';

  if (isImg(file.mimeType) && file.thumbnailLink) {
    const img     = document.createElement('img');
    img.src       = file.thumbnailLink;
    img.alt       = file.name;
    img.loading   = 'lazy';
    thumb.appendChild(img);
  } else {
    const ico = document.createElement('span');
    ico.className   = 'fc-icon';
    ico.textContent = mimeIcon(file.mimeType);
    thumb.appendChild(ico);
  }

  if (hasExpl) {
    const badge       = document.createElement('div');
    badge.className   = 'expl-badge';
    badge.textContent = '📖 Ada penjelasan';
    thumb.appendChild(badge);
  }

  const info   = document.createElement('div'); info.className   = 'fc-info';
  const nameEl = document.createElement('div'); nameEl.className = 'fc-name'; nameEl.textContent = file.name;
  const metaEl = document.createElement('div'); metaEl.className = 'fc-meta'; metaEl.textContent = mimeLabel(file.mimeType);
  info.appendChild(nameEl); info.appendChild(metaEl);
  card.appendChild(thumb); card.appendChild(info);
  card.addEventListener('click', () => showOptions(file));
  return card;
}

// ── Options modal ─────────────────────────────────────────────────

/**
 * Tampilkan bottom-sheet modal dengan pilihan aksi untuk file.
 * Opsi berbeda tergantung: apakah gambar? ada penjelasan?
 * @param {object} file - metadata Drive
 */
function showOptions(file) {
  state.currentFile = file;
  const entry = dbGet(file.id);
  const img   = isImg(file.mimeType);

  document.getElementById('opt-title').childNodes[0].textContent = file.name;
  document.getElementById('opt-sub').textContent = mimeLabel(file.mimeType);

  const body = document.getElementById('opt-body');
  body.innerHTML = '';
  const opts = [];

  if (img) {
    opts.push({ ico: '🔍', bg: '#eef2ff', label: 'Preview',
      desc: 'Lihat gambar ukuran penuh',
      fn: () => { closeModal('options-modal'); openLightbox(file); } });
  } else {
    opts.push({ ico: '↗️', bg: '#f0fdf4', label: 'Lihat di Drive',
      desc: 'Buka file di Google Drive',
      fn: () => { closeModal('options-modal'); if (file.webViewLink) window.open(file.webViewLink, '_blank'); } });
  }

  if (entry) {
    opts.push({ ico: '📖', bg: '#fffbeb', label: 'Lihat Penjelasan',
      desc: 'Buka halaman penjelasan',
      fn: () => { closeModal('options-modal'); openExplanation(file, entry); } });
    opts.push({ ico: '✏️', bg: '#f0f9ff', label: 'Edit Penjelasan',
      desc: 'Ubah konten penjelasan',
      fn: () => { closeModal('options-modal'); openEditor(file, entry); } });
  } else {
    opts.push({ ico: '📝', bg: '#fef2f2', label: 'Tambah Penjelasan',
      desc: 'Buat penjelasan baru',
      fn: () => { closeModal('options-modal'); openEditor(file, null); } });
  }

  opts.push({ ico: '🔗', bg: '#f8fafc', label: 'Bagikan',
    desc: 'Salin atau bagikan link file',
    fn: () => { closeModal('options-modal'); showShareModal(file); } });

  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'modal-option';
    btn.innerHTML = `
      <div class="modal-opt-icon" style="background:${opt.bg}">${opt.ico}</div>
      <div><div class="modal-opt-label">${opt.label}</div><div class="modal-opt-desc">${opt.desc}</div></div>`;
    btn.addEventListener('click', opt.fn);
    body.appendChild(btn);
  });

  openModal('options-modal');
}

/** Buka modal (tambah class 'open') */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
/** Tutup modal (hapus class 'open') */
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
