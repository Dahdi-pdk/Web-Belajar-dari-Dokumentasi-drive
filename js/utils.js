/**
 * utils.js
 * ────────
 * Fungsi-fungsi utilitas murni (tidak ada efek samping DOM kompleks)
 * yang dipakai di seluruh modul.
 */

// ── String / XSS ──────────────────────────────────────────────────

/** Escape HTML untuk mencegah XSS saat menyisipkan teks ke innerHTML */
const esc = s => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};

// ── MIME helpers ──────────────────────────────────────────────────

/** Apakah MIME type adalah gambar? */
const isImg = m => !!m?.startsWith('image/');

/** Apakah MIME type adalah folder Google Drive? */
const isFld = m => m === 'application/vnd.google-apps.folder';

/** Label teks ramah pengguna dari MIME type */
function mimeLabel(m) {
  return ({
    'application/vnd.google-apps.folder':       'Folder',
    'application/vnd.google-apps.document':     'Google Docs',
    'application/vnd.google-apps.spreadsheet':  'Google Sheets',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/pdf':   'PDF',
    'text/plain':        'Teks',
    'application/zip':   'ZIP',
  })[m] ?? (m?.split('/').pop() ?? 'File');
}

/** Emoji ikon sesuai MIME type */
function mimeIcon(m) {
  if (isFld(m))                    return '📁';
  if (isImg(m))                    return '🖼️';
  if (m?.includes('document'))     return '📝';
  if (m?.includes('spreadsheet'))  return '📊';
  if (m?.includes('presentation')) return '📽️';
  if (m === 'application/pdf')     return '📕';
  if (m?.startsWith('video/'))     return '🎬';
  if (m?.startsWith('audio/'))     return '🎵';
  return '📄';
}

// ── UI feedback ───────────────────────────────────────────────────

/**
 * Catat pesan ke debug panel dan console.
 * @param {string} msg  - pesan
 * @param {'info'|'success'|'warning'|'error'} type
 */
function log(msg, type = 'info') {
  const p = document.getElementById('debug-panel');
  const d = document.createElement('div');
  d.className = `l-${type}`;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  p.appendChild(d);
  p.scrollTop = p.scrollHeight;
  console[type === 'error' ? 'error' : 'log'](`[${type}]`, msg);
}

/**
 * Tampilkan toast notifikasi sementara.
 * @param {string} msg
 * @param {''|'ok'|'err'} type
 */
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toast-wrap').appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

/** Tampilkan loading overlay dengan pesan */
function showLoad(txt = 'Memuat...') {
  document.getElementById('loading-text').textContent = txt;
  document.getElementById('loading-overlay').classList.remove('hidden');
}

/** Sembunyikan loading overlay */
function hideLoad() {
  document.getElementById('loading-overlay').classList.add('hidden');
}
