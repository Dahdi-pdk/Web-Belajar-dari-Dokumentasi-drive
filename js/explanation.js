/**
 * explanation.js
 * ──────────────
 * Mengelola halaman penjelasan (view-explanation) dan editor blok (view-editor).
 *
 * Halaman Penjelasan:
 *  - Tampilkan gambar sumber resolusi asli (blob dari Drive, fallback thumbnail)
 *  - Gambar klikable → openLightbox() untuk zoom penuh
 *  - Render blok konten: heading, paragraph, math, code, list, callout, image, embed
 *  - Riwayat pengeditan bisa dibuka via tombol "📋 Riwayat Pengeditan"
 *
 * Editor Blok:
 *  - Tambah/hapus/naik/turun blok secara visual
 *  - Simpan → menulis ke Drive + update database.json + rekam riwayat
 *  - Preview mode sebelum simpan
 *
 * Format file penjelasan JSON di FOLDER_2:
 * {
 *   "fileId": "drive-file-id",
 *   "fileName": "nama-gambar.jpg",
 *   "title": "Judul Penjelasan",
 *   "blocks": [ ... ],
 *   "updatedAt": "ISO-timestamp",
 *   "history": [ { action, name, email, picture, timestamp } ]
 * }
 */

// ═══════════════════════════════════════════════════════════════════
// EXPLANATION VIEW
// ═══════════════════════════════════════════════════════════════════

/**
 * Buka halaman penjelasan untuk file tertentu.
 * @param {object} file  - metadata Drive
 * @param {object} entry - entri dari database (berisi explanationFileId)
 * @param {boolean} pushBc - tambahkan ke breadcrumb?
 */
async function openExplanation(file, entry, pushBc = true) {
  showLoad('Memuat penjelasan...');
  state.currentExplFile = file;
  if (pushBc) {
    state.breadcrumb.push({ id: `expl-${file.id}`, name: '📖 Penjelasan', view: 'explanation' });
    updateBreadcrumb();
  }
  showView('explanation');

  try {
    const raw  = await getFileText(entry.explanationFileId);
    const data = JSON.parse(raw);
    const hdr  = document.getElementById('expl-header');
    hdr.innerHTML = '';

    // ── Gambar sumber (resolusi asli, klikable) ──
    if (isImg(file.mimeType)) {
      const wrap      = document.createElement('div');
      wrap.className  = 'expl-source-wrap';
      wrap.title      = 'Klik untuk preview resolusi asli';
      const spin      = document.createElement('div');
      spin.className  = 'spinner';
      wrap.appendChild(spin);

      const img       = document.createElement('img');
      img.className   = 'expl-source-img';
      img.alt         = file.name;
      getFileBlob(file.id)
        .then(url  => { img.src = url; })
        .catch(()  => { img.src = file.thumbnailLink || ''; });
      img.onload  = () => { img.classList.add('loaded'); spin.remove(); };
      img.onerror = () => { spin.remove(); };
      wrap.appendChild(img);
      wrap.addEventListener('click', () => openLightbox(file));
      hdr.appendChild(wrap);

      // Tombol preview resolusi asli eksplisit
      const prevRow     = document.createElement('div');
      prevRow.className = 'expl-preview-row';
      const prevBtn     = document.createElement('button');
      prevBtn.className = 'btn btn-outline btn-sm';
      prevBtn.innerHTML = '🔍 Preview Resolusi Asli';
      prevBtn.addEventListener('click', () => openLightbox(file));
      prevRow.appendChild(prevBtn);
      hdr.appendChild(prevRow);
    }

    const h1         = document.createElement('h1');
    h1.className     = 'expl-h1';
    h1.textContent   = data.title || file.name;
    const meta       = document.createElement('div');
    meta.className   = 'expl-meta';
    meta.textContent = `Berkas: ${file.name}  •  Diperbarui: ${
      new Date(data.updatedAt || Date.now())
        .toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })
    }`;
    hdr.appendChild(h1);
    hdr.appendChild(meta);

    await renderBlocks(data.blocks || [], document.getElementById('blocks-render'));
    renderExplHistory(data.history || []);

    document.getElementById('expl-hist-section').classList.remove('open');

    document.getElementById('expl-edit-btn').onclick = () => {
      state.breadcrumb.pop(); updateBreadcrumb(); openEditor(file, entry);
    };
    document.getElementById('expl-back-btn').onclick = () => {
      state.breadcrumb.pop(); updateBreadcrumb(); showView('files');
    };
    document.getElementById('expl-about-btn').onclick = () => {
      document.getElementById('expl-hist-section').classList.toggle('open');
    };
  } catch (e) {
    log(e.message, 'error');
    toast('❌ Gagal memuat penjelasan', 'err');
  }
  hideLoad();
}

/**
 * Render daftar riwayat pengeditan di dalam halaman penjelasan.
 * @param {Array} history
 */
function renderExplHistory(history) {
  const list  = document.getElementById('expl-hist-list');
  list.innerHTML = '';
  if (!history.length) {
    list.innerHTML = '<div style="padding:14px 16px;font-size:12px;color:var(--text-2)">Belum ada riwayat pengeditan.</div>';
    return;
  }
  [...history].reverse().forEach(h => {
    const el          = document.createElement('div');
    el.className      = 'expl-hist-item';
    const avatarHtml  = h.picture ? `<img src="${esc(h.picture)}" alt="">` : (h.name?.[0] || '?');
    const actionLabel = h.action === 'create' ? '✨ Dibuat' : '✏️ Diedit';
    const timeStr     = h.timestamp
      ? new Date(h.timestamp).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' })
      : '—';
    el.innerHTML = `
      <div class="expl-hist-mini-avatar">${avatarHtml}</div>
      <div class="expl-hist-detail">
        <div class="expl-hist-name">${esc(h.name || h.email || 'Anonim')} — ${actionLabel}</div>
        <div class="expl-hist-desc">${esc(h.email || '')}</div>
        <div class="expl-hist-time">${timeStr}</div>
      </div>`;
    list.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
// BLOCK RENDERER
// ═══════════════════════════════════════════════════════════════════

/**
 * Render array blok ke container DOM.
 * Secara otomatis memuat KaTeX jika ada blok 'math'.
 * @param {Array}       blocks
 * @param {HTMLElement} container
 */
async function renderBlocks(blocks, container) {
  container.innerHTML = '';
  const hasMath = blocks.some(b => b.type === 'math');
  if (hasMath && !state.katexLoaded) await loadKaTeX();

  const frag = document.createDocumentFragment();
  for (const b of blocks) {
    const el = renderBlock(b);
    if (el) frag.appendChild(el);
  }
  container.appendChild(frag);

  if (hasMath && window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$',   display: true  },
        { left: '$',  right: '$',    display: false },
        { left: '\\[', right: '\\]', display: true  },
        { left: '\\(', right: '\\)', display: false },
      ],
      macros: {
        '\\vec': '\\boldsymbol{#1}',
        '\\d':   '\\mathrm{d}',
        '\\dv':  '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
        '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
      },
      throwOnError: false,
    });
  }
}

/**
 * Render satu blok ke elemen DOM.
 * @param {object} b - objek blok { type, ... }
 * @returns {HTMLElement|null}
 */
function renderBlock(b) {
  switch (b.type) {
    case 'heading': {
      const lv = Math.min(Math.max(b.level ?? 2, 1), 3);
      const el = document.createElement(`h${lv}`);
      el.className = `b-h${lv}`; el.textContent = b.content;
      return el;
    }
    case 'paragraph': {
      const el = document.createElement('p');
      el.className = 'b-p'; el.innerHTML = b.content;
      return el;
    }
    case 'math': {
      const el = document.createElement('div');
      el.className = 'b-math'; el.textContent = `$$${b.content}$$`;
      return el;
    }
    case 'code': {
      const wrap = document.createElement('div');
      wrap.className = 'b-code-wrap';
      wrap.innerHTML = `<div class="b-code-hdr"><span class="b-code-lang">${esc(b.language || 'code')}</span></div>
        <div class="b-code-body"><pre>${esc(b.content)}</pre></div>`;
      return wrap;
    }
    case 'list': {
      const wrap = document.createElement('div');
      wrap.className = 'b-list';
      const list = document.createElement(b.ordered ? 'ol' : 'ul');
      (b.items || []).forEach(item => {
        const li = document.createElement('li'); li.textContent = item; list.appendChild(li);
      });
      wrap.appendChild(list);
      return wrap;
    }
    case 'divider': {
      const hr = document.createElement('hr');
      hr.className = 'b-divider';
      return hr;
    }
    case 'callout': {
      const el = document.createElement('div');
      el.className = `b-callout ${b.variant || ''}`;
      el.innerHTML = b.content;
      return el;
    }
    case 'image': {
      const fig = document.createElement('figure');
      fig.className = 'b-img';
      const img       = document.createElement('img');
      img.alt         = b.caption || '';
      img.loading     = 'lazy';
      img.crossOrigin = 'anonymous';
      img.src         = b.url || '';
      img.onerror = () => {
        const errDiv      = document.createElement('div');
        errDiv.className  = 'b-img-error';
        errDiv.innerHTML  = `🖼️ Gambar tidak dapat dimuat.<br><a href="${esc(b.url)}" target="_blank" rel="noopener">Buka link gambar ↗</a>`;
        fig.replaceChild(errDiv, img);
      };
      fig.appendChild(img);
      if (b.caption) {
        const cap = document.createElement('figcaption');
        cap.className = 'b-caption'; cap.textContent = b.caption; fig.appendChild(cap);
      }
      return fig;
    }
    case 'embed':
      return renderEmbedBlock(b);
    default:
      return null;
  }
}

/**
 * Muat KaTeX + mhchem + auto-render secara lazy (hanya jika dibutuhkan).
 * Mendukung: matematika, kimia (\ce{H2O}), fisika (\vec, \dv, \pdv).
 */
async function loadKaTeX() {
  if (state.katexLoaded) return;
  return new Promise(resolve => {
    const css  = document.createElement('link');
    css.rel    = 'stylesheet';
    css.href   = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(css);

    const s1   = document.createElement('script');
    s1.src     = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    s1.onload  = () => {
      // mhchem: notasi kimia \ce{...}
      const sChem  = document.createElement('script');
      sChem.src    = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/mhchem.min.js';
      document.head.appendChild(sChem);
      // auto-render: scan DOM untuk delimiters $...$, $$...$$
      const s2     = document.createElement('script');
      s2.src       = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
      s2.onload    = () => { state.katexLoaded = true; resolve(); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  });
}

// ═══════════════════════════════════════════════════════════════════
// EMBED BLOCK RENDERER
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse URL embed untuk menentukan platform.
 * @param {string} url
 * @returns {{ type: string, ... }}
 */
function parseEmbedUrl(url) {
  try {
    const u = new URL(url.trim());
    const h = u.hostname.replace('www.', '').replace('m.', '');

    if (h === 'youtube.com' || h === 'youtu.be') {
      let vid = u.searchParams.get('v');
      if (!vid && h === 'youtu.be')                    vid = u.pathname.slice(1).split('/')[0];
      if (!vid && u.pathname.startsWith('/embed/'))    vid = u.pathname.split('/')[2];
      if (!vid && u.pathname.startsWith('/shorts/'))   vid = u.pathname.split('/')[2];
      if (vid) return { type: 'youtube', id: vid };
    }
    if (h === 'instagram.com') {
      const m = u.pathname.match(/\/(p|reel|tv)\/([\w-]+)/);
      if (m) return { type: 'instagram', path: u.pathname };
    }
    if (h === 'twitter.com' || h === 'x.com') {
      const m = u.pathname.match(/\/\w+\/status\/(\d+)/);
      if (m) return { type: 'twitter', tweetId: m[1], url };
    }
    if (h === 'tiktok.com') {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m) return { type: 'tiktok', id: m[1] };
    }
    if (h === 'drive.google.com') {
      const dm = url.match(/\/d\/([\w-]+)/);
      if (dm) return { type: 'gdrive', id: dm[1] };
    }
  } catch (_) { /* URL tidak valid */ }
  return { type: 'link', url };
}

/**
 * Render blok embed menjadi elemen DOM yang sesuai.
 * @param {object} b - blok { type:'embed', url, caption }
 */
function renderEmbedBlock(b) {
  if (!b.url?.trim()) {
    const el      = document.createElement('div');
    el.className  = 'b-embed-link';
    el.innerHTML  = '<span class="b-embed-link-ico">🔗</span><div class="b-embed-link-body"><div class="b-embed-link-title">URL embed kosong</div></div>';
    return el;
  }

  const info = parseEmbedUrl(b.url);
  const wrap = document.createElement('div');
  wrap.className = 'b-embed';

  switch (info.type) {
    case 'youtube': {
      wrap.classList.add('b-embed-yt');
      const src = `https://www.youtube-nocookie.com/embed/${info.id}?rel=0&modestbranding=1`;
      wrap.innerHTML = `<iframe src="${src}" title="${esc(b.caption || 'YouTube')}" allowfullscreen
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe>`;
      break;
    }
    case 'instagram': {
      wrap.classList.add('b-embed-social');
      const postUrl = `https://www.instagram.com${info.path}`;
      wrap.innerHTML = `
        <span class="b-embed-label">📸 Instagram</span>
        <blockquote class="instagram-media" data-instgrm-permalink="${postUrl}"
          data-instgrm-version="14"
          style="width:100%;min-width:326px;border:0;border-radius:8px;margin:0"></blockquote>`;
      if (!document.getElementById('ig-embed-js')) {
        const s = document.createElement('script');
        s.id = 'ig-embed-js'; s.src = 'https://www.instagram.com/embed.js'; s.async = true;
        document.body.appendChild(s);
      } else if (window.instgrm) { window.instgrm.Embeds.process(); }
      break;
    }
    case 'twitter': {
      wrap.classList.add('b-embed-social');
      wrap.innerHTML = `<span class="b-embed-label">𝕏 Twitter / X</span>
        <div id="tw-${info.tweetId}" style="width:100%"></div>`;
      if (!window.twttr) {
        const s = document.createElement('script');
        s.src = 'https://platform.twitter.com/widgets.js'; s.async = true;
        s.onload = () => window.twttr?.widgets.createTweet(info.tweetId, document.getElementById(`tw-${info.tweetId}`));
        document.body.appendChild(s);
      } else { window.twttr.widgets.createTweet(info.tweetId, document.getElementById(`tw-${info.tweetId}`)); }
      break;
    }
    case 'tiktok': {
      wrap.classList.add('b-embed-social');
      wrap.innerHTML = `<span class="b-embed-label">🎵 TikTok</span>
        <blockquote class="tiktok-embed" data-video-id="${info.id}" style="width:100%;min-width:325px;border:none"></blockquote>`;
      if (!document.getElementById('tt-embed-js')) {
        const s = document.createElement('script');
        s.id = 'tt-embed-js'; s.src = 'https://www.tiktok.com/embed.js'; s.async = true;
        document.body.appendChild(s);
      }
      break;
    }
    case 'gdrive': {
      wrap.className  = 'b-embed-link';
      const viewUrl   = `https://drive.google.com/file/d/${info.id}/view`;
      wrap.innerHTML  = `
        <span class="b-embed-link-ico">🗂️</span>
        <div class="b-embed-link-body">
          <div class="b-embed-link-title">${esc(b.caption || 'Google Drive File')}</div>
          <div class="b-embed-link-url">${esc(b.url)}</div>
          <div style="margin-top:6px"><a href="${viewUrl}" target="_blank" rel="noopener">Buka di Drive ↗</a></div>
        </div>`;
      break;
    }
    default: {
      wrap.className  = 'b-embed-link';
      wrap.innerHTML  = `
        <span class="b-embed-link-ico">🔗</span>
        <div class="b-embed-link-body">
          <div class="b-embed-link-title">${esc(b.caption || b.url)}</div>
          <div class="b-embed-link-url">${esc(b.url)}</div>
          <a href="${esc(b.url)}" target="_blank" rel="noopener">Buka link ↗</a>
        </div>`;
    }
  }

  if (b.caption && info.type !== 'link' && info.type !== 'gdrive') {
    const cap = document.createElement('div');
    cap.className = 'b-caption'; cap.textContent = b.caption;
    const outer = document.createElement('div');
    outer.appendChild(wrap); outer.appendChild(cap);
    return outer;
  }
  return wrap;
}

// ═══════════════════════════════════════════════════════════════════
// BLOCK EDITOR
// ═══════════════════════════════════════════════════════════════════

/** Definisi semua tipe blok yang tersedia */
const BLOCK_DEFS = [
  { type: 'heading',   icon: '🔤', label: 'Judul'       },
  { type: 'paragraph', icon: '📝', label: 'Teks'        },
  { type: 'math',      icon: '∑',  label: 'Rumus LaTeX' },
  { type: 'code',      icon: '💻', label: 'Kode'        },
  { type: 'list',      icon: '📋', label: 'Daftar'      },
  { type: 'image',     icon: '🖼️', label: 'Gambar URL'  },
  { type: 'embed',     icon: '▶️', label: 'Embed/Video' },
  { type: 'callout',   icon: '💡', label: 'Callout'     },
  { type: 'divider',   icon: '―',  label: 'Pemisah'     },
];

/** Nilai default untuk setiap tipe blok baru */
const BLOCK_DEFAULTS = {
  heading:   { type:'heading',   level:2,           content:'Judul Baru'               },
  paragraph: { type:'paragraph',                    content:''                          },
  math:      { type:'math',                         content:''                          },
  code:      { type:'code',      language:'python', content:''                          },
  list:      { type:'list',      ordered:false,     items:['Item 1','Item 2']           },
  image:     { type:'image',     url:'',            caption:''                          },
  embed:     { type:'embed',     url:'',            caption:''                          },
  callout:   { type:'callout',   variant:'info',    content:''                          },
  divider:   { type:'divider'                                                            },
};

/**
 * Buka halaman editor untuk membuat/mengedit penjelasan.
 * @param {object}      file   - metadata Drive
 * @param {object|null} entry  - entri database (null = buat baru)
 * @param {boolean}     pushBc - tambahkan ke breadcrumb?
 */
function openEditor(file, entry, pushBc = true) {
  state.editorFile  = file;
  state.editorEntry = entry;
  document.getElementById('editor-subtitle').textContent = `Berkas: ${file.name}`;

  if (pushBc) {
    state.breadcrumb.push({ id: `edit-${file.id}`, name: '✏️ Editor', view: 'editor' });
    updateBreadcrumb();
  }

  if (entry) {
    showLoad('Memuat editor...');
    getFileText(entry.explanationFileId).then(raw => {
      const data = JSON.parse(raw);
      state.editorBlocks = data.blocks || [];
      document.getElementById('editor-title-input').value = data.title || file.name;
      renderEditorBlocks();
      hideLoad();
    }).catch(e => { log(e.message, 'error'); hideLoad(); });
  } else {
    state.editorBlocks = [
      { ...BLOCK_DEFAULTS.heading,   content: file.name },
      { ...BLOCK_DEFAULTS.paragraph, content: 'Tulis penjelasan di sini...' },
    ];
    document.getElementById('editor-title-input').value = file.name;
    renderEditorBlocks();
  }

  buildAddMenu(document.getElementById('main-add-menu'), -1);
  showView('editor');
}

/** Render ulang semua blok di editor */
function renderEditorBlocks() {
  const wrap = document.getElementById('editor-blocks-wrap');
  wrap.innerHTML = '';
  state.editorBlocks.forEach((b, i) => wrap.appendChild(makeEditorBlock(b, i)));
}

/**
 * Buat satu card editor untuk sebuah blok.
 * Berisi toolbar (↑ ↓ 🗑), input fields, dan add-zone di bawahnya.
 */
function makeEditorBlock(block, index) {
  const def  = BLOCK_DEFS.find(d => d.type === block.type) || { icon: '📄', label: block.type };
  const wrap = document.createElement('div');
  wrap.className = 'editor-block';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'blk-toolbar';
  toolbar.innerHTML = `
    <span class="blk-type-tag">${def.icon} ${def.label}</span>
    <button class="btn btn-ghost btn-xs btn-icon" data-a="up"   title="Naik">↑</button>
    <button class="btn btn-ghost btn-xs btn-icon" data-a="down" title="Turun">↓</button>
    <button class="btn btn-danger-soft btn-xs btn-icon" data-a="del" title="Hapus">🗑</button>`;
  toolbar.querySelectorAll('[data-a]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.a;
      if (a === 'del') {
        state.editorBlocks.splice(index, 1);
      } else if (a === 'up' && index > 0) {
        [state.editorBlocks[index - 1], state.editorBlocks[index]] =
        [state.editorBlocks[index],     state.editorBlocks[index - 1]];
      } else if (a === 'down' && index < state.editorBlocks.length - 1) {
        [state.editorBlocks[index],     state.editorBlocks[index + 1]] =
        [state.editorBlocks[index + 1], state.editorBlocks[index]];
      }
      renderEditorBlocks();
    });
  });

  const body = document.createElement('div');
  body.className = 'blk-body';
  body.appendChild(makeBlockInputs(block));

  // Add-zone di bawah blok ini
  const addZone        = document.createElement('div');
  addZone.className    = 'add-zone';
  addZone.style.cssText = 'margin:0;padding:8px;font-size:12px;border-width:1px 0 0;border-radius:0';
  addZone.textContent  = '+ Tambah blok di bawah';
  const addMenu        = document.createElement('div');
  addMenu.className    = 'add-menu';
  addMenu.style.display = 'none';
  addZone.appendChild(addMenu);
  buildAddMenu(addMenu, index);
  addZone.addEventListener('click', e => {
    if (!e.target.closest('.add-opt'))
      addMenu.style.display = addMenu.style.display === 'none' ? 'grid' : 'none';
  });

  wrap.appendChild(toolbar); wrap.appendChild(body); wrap.appendChild(addZone);
  return wrap;
}

/** Buat input fields untuk satu blok sesuai tipenya */
function makeBlockInputs(block) {
  const frag = document.createDocumentFragment();
  const ta  = (val, ph, rows = 4, mono = false) => {
    const el = document.createElement('textarea');
    el.className = 'blk-ta'; el.value = val; el.placeholder = ph; el.rows = rows;
    if (mono) el.style.fontFamily = 'monospace';
    return el;
  };
  const inp = (val, ph) => {
    const el = document.createElement('input');
    el.className = 'blk-input'; el.type = 'text'; el.value = val; el.placeholder = ph;
    return el;
  };
  const sel = (opts, cur) => {
    const el = document.createElement('select');
    el.className = 'blk-select';
    opts.forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if (String(v) === String(cur)) o.selected = true;
      el.appendChild(o);
    });
    return el;
  };

  switch (block.type) {
    case 'heading': {
      const row = document.createElement('div'); row.className = 'blk-row';
      const s = sel([[1,'H1'],[2,'H2'],[3,'H3']], block.level ?? 2);
      s.style.cssText = 'width:72px;flex:none'; s.onchange = () => block.level = parseInt(s.value);
      const i = inp(block.content, 'Teks judul...'); i.oninput = () => block.content = i.value;
      row.appendChild(s); row.appendChild(i); frag.appendChild(row); break;
    }
    case 'paragraph': {
      const t = ta(block.content, 'Tulis paragraf...'); t.oninput = () => block.content = t.value;
      const h = document.createElement('p'); h.className = 'blk-hint';
      h.textContent = '💡 Tag HTML dasar: <b>, <i>, <a>, <br>';
      frag.appendChild(t); frag.appendChild(h); break;
    }
    case 'math': {
      const t = ta(block.content, 'E = mc^2  atau  \\frac{a}{b}', 3, true); t.oninput = () => block.content = t.value;
      const h = document.createElement('p'); h.className = 'blk-hint';
      h.textContent = '∑ LaTeX: $...$ inline | $$...$$ display | \\ce{H2O} kimia';
      frag.appendChild(t); frag.appendChild(h); break;
    }
    case 'code': {
      const row = document.createElement('div'); row.className = 'blk-row';
      const i = inp(block.language || 'python', 'Bahasa...'); i.style.width = '150px'; i.oninput = () => block.language = i.value;
      row.appendChild(i); frag.appendChild(row);
      const t = ta(block.content, 'Tulis kode...', 6, true); t.oninput = () => block.content = t.value;
      frag.appendChild(t); break;
    }
    case 'list': {
      const row = document.createElement('div'); row.className = 'blk-row';
      const s = sel([['false','● Berpoin'],['true','1. Bernomor']], String(block.ordered));
      s.style.cssText = 'width:130px;flex:none'; s.onchange = () => block.ordered = s.value === 'true';
      row.appendChild(s); frag.appendChild(row);
      const t = ta((block.items || []).join('\n'), 'Satu item per baris...');
      t.oninput = () => block.items = t.value.split('\n').filter(l => l.trim());
      frag.appendChild(t); break;
    }
    case 'image': {
      const ui = inp(block.url || '', 'URL langsung (https://example.com/foto.jpg)');
      ui.oninput = () => block.url = ui.value;
      const ci = inp(block.caption || '', 'Caption (opsional)'); ci.oninput = () => block.caption = ci.value;
      const h = document.createElement('p'); h.className = 'blk-hint';
      h.textContent = '💡 URL langsung ke file gambar (jpg/png/webp), bukan halaman web.';
      frag.appendChild(ui); frag.appendChild(ci); frag.appendChild(h); break;
    }
    case 'embed': {
      const ui = inp(block.url || '', 'URL YouTube, Instagram, Twitter/X, TikTok, Drive...');
      ui.oninput = () => block.url = ui.value;
      const ci = inp(block.caption || '', 'Caption (opsional)'); ci.oninput = () => block.caption = ci.value;
      const h = document.createElement('p'); h.className = 'blk-hint';
      h.innerHTML = '▶️ Mendukung: <b>YouTube</b>, Instagram, Twitter/X, TikTok, Google Drive.';
      frag.appendChild(ui); frag.appendChild(ci); frag.appendChild(h); break;
    }
    case 'callout': {
      const row = document.createElement('div'); row.className = 'blk-row';
      const s = sel([['info','ℹ️ Info'],['warn','⚠️ Peringatan'],['danger','🚨 Bahaya'],['success','✅ Sukses']], block.variant || 'info');
      s.style.cssText = 'width:140px;flex:none'; s.onchange = () => block.variant = s.value;
      row.appendChild(s); frag.appendChild(row);
      const t = ta(block.content, 'Isi callout...', 3); t.oninput = () => block.content = t.value;
      frag.appendChild(t); break;
    }
    case 'divider': {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:13px;color:var(--text-3);text-align:center';
      p.textContent = '─────── Garis pemisah ───────';
      frag.appendChild(p); break;
    }
  }
  return frag;
}

/** Isi menu "tambah blok" dengan semua pilihan tipe blok */
function buildAddMenu(menuEl, afterIndex) {
  menuEl.innerHTML = '';
  BLOCK_DEFS.forEach(def => {
    const btn = document.createElement('button');
    btn.className = 'add-opt';
    btn.innerHTML = `<span>${def.icon}</span><span>${def.label}</span>`;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const nb = { ...BLOCK_DEFAULTS[def.type] };
      if (afterIndex < 0 || afterIndex >= state.editorBlocks.length) {
        state.editorBlocks.push(nb);
      } else {
        state.editorBlocks.splice(afterIndex + 1, 0, nb);
      }
      renderEditorBlocks();
      menuEl.style.display = 'none';
    });
    menuEl.appendChild(btn);
  });
}

/** Simpan penjelasan ke Drive — tulis file JSON + update database + catat riwayat */
async function saveExplanation() {
  const btn    = document.getElementById('editor-save-btn');
  const title  = document.getElementById('editor-title-input').value.trim() || state.editorFile.name;
  const isNew  = !state.editorEntry;

  const histEntry = {
    action:    isNew ? 'create' : 'edit',
    name:      state.user?.name    || 'Anonim',
    email:     state.user?.email   || '',
    picture:   state.user?.picture || null,
    timestamp: new Date().toISOString(),
    sub:       state.user?.sub     || null,
  };

  let existingHistory = [];
  if (!isNew) {
    try {
      const raw = await getFileText(state.editorEntry.explanationFileId);
      existingHistory = JSON.parse(raw).history || [];
    } catch (_) {}
  }
  existingHistory.push(histEntry);

  const data    = {
    fileId:    state.editorFile.id,
    fileName:  state.editorFile.name,
    title,
    blocks:    state.editorBlocks,
    updatedAt: new Date().toISOString(),
    history:   existingHistory,
  };
  const payload = JSON.stringify(data, null, 2);
  btn.disabled  = true;

  try {
    showLoad('Menyimpan penjelasan...');
    let explId, explName;

    if (!isNew) {
      explId   = state.editorEntry.explanationFileId;
      explName = state.editorEntry.explanationFileName;
      await updateFile(explId, payload);
    } else {
      explName = `explanation_${state.editorFile.id}.json`;
      const c  = await createFile(CONFIG.FOLDER_2_ID, explName, payload);
      explId   = c.id;
    }

    await dbSet(state.editorFile.id, state.editorFile.name, explId, explName, histEntry);
    state.editorEntry = { explanationFileId: explId, explanationFileName: explName };
    hideLoad();
    toast('✅ Penjelasan berhasil disimpan!', 'ok');
    log(`Penjelasan disimpan: ${explName}`, 'success');
  } catch (e) {
    hideLoad();
    log(`Gagal simpan: ${e.message}`, 'error');
    toast('❌ Gagal menyimpan', 'err');
  }
  btn.disabled = false;
}

/** Preview penjelasan langsung dari blok editor (tanpa menyimpan) */
function previewExplanation() {
  if (!state.editorFile) return;
  const title = document.getElementById('editor-title-input').value.trim() || state.editorFile.name;
  state.breadcrumb.push({ id: `prev-${state.editorFile.id}`, name: '👁 Preview', view: 'explanation' });
  updateBreadcrumb();
  showView('explanation');

  const hdr      = document.getElementById('expl-header');
  hdr.innerHTML  = '';
  const h1       = document.createElement('h1'); h1.className = 'expl-h1'; h1.textContent = title;
  const meta     = document.createElement('div'); meta.className = 'expl-meta';
  meta.textContent = `Preview • ${state.editorFile.name}`;
  hdr.appendChild(h1); hdr.appendChild(meta);

  renderBlocks(state.editorBlocks, document.getElementById('blocks-render'));

  document.getElementById('expl-edit-btn').onclick = () => { state.breadcrumb.pop(); updateBreadcrumb(); showView('editor'); };
  document.getElementById('expl-back-btn').onclick = () => { state.breadcrumb.pop(); updateBreadcrumb(); showView('editor'); };
}
