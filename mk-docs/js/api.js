/**
 * api.js
 * ──────
 * Wrapper tipis untuk Google Drive API v3.
 * Semua request melewati driveReq() yang otomatis menyisipkan Authorization header
 * dan menangani error 401 (token expired).
 *
 * Semua fungsi adalah async dan melempar Error jika request gagal.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Buat HTTP request ke Drive API dengan token aktif.
 * @param {string} path  - path relatif (/files?...) atau URL lengkap
 * @param {RequestInit} opts - fetch options tambahan
 * @returns {Promise<Response>}
 */
async function driveReq(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${DRIVE_API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${state.accessToken}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { forceLogout(); throw new Error('Sesi berakhir'); }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `HTTP ${res.status}`);
  }
  return res;
}

/**
 * Ambil daftar file/folder di dalam sebuah folder.
 * @param {string} folderId
 * @returns {Promise<Array>} array file metadata
 */
async function listFolder(folderId) {
  const q = `'${folderId}' in parents and trashed = false`;
  const f = 'files(id,name,mimeType,webViewLink,thumbnailLink,size)';
  const r = await driveReq(
    `/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(f)}&orderBy=folder,name&pageSize=200`
  );
  return (await r.json()).files || [];
}

/**
 * Unduh isi file sebagai teks (JSON, HTML, dsb).
 * @param {string} fileId
 * @returns {Promise<string>}
 */
async function getFileText(fileId) {
  const r = await driveReq(`/files/${fileId}?alt=media`);
  return r.text();
}

/**
 * Unduh file sebagai Blob dan kembalikan object URL (ter-cache lokal).
 * @param {string} fileId
 * @returns {Promise<string>} objectURL
 */
async function getFileBlob(fileId) {
  if (state.blobCache[fileId]) return state.blobCache[fileId];
  const r   = await driveReq(`/files/${fileId}?alt=media`);
  const url = URL.createObjectURL(await r.blob());
  state.blobCache[fileId] = url;
  return url;
}

/**
 * Cari satu file berdasarkan nama di dalam folder.
 * @param {string} folderId
 * @param {string} filename
 * @returns {Promise<{id,name}|null>}
 */
async function findInFolder(folderId, filename) {
  const q = `'${folderId}' in parents and name = '${filename.replace(/'/g, "\\'")}' and trashed = false`;
  const r = await driveReq(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`
  );
  return (await r.json()).files?.[0] ?? null;
}

/**
 * Buat file baru di Drive dengan konten teks/JSON.
 * @param {string} folderId   - folder tujuan
 * @param {string} filename
 * @param {string} content    - isi file (string)
 * @param {string} mimeType
 * @returns {Promise<{id,name}>}
 */
async function createFile(folderId, filename, content, mimeType = 'application/json') {
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: mimeType }));
  const r = await driveReq(
    `${UPLOAD_API}/files?uploadType=multipart`,
    { method: 'POST', body: form }
  );
  return r.json();
}

/**
 * Update isi file yang sudah ada.
 * @param {string} fileId
 * @param {string} content
 * @param {string} mimeType
 * @returns {Promise<{id,name}>}
 */
async function updateFile(fileId, content, mimeType = 'application/json') {
  const r = await driveReq(
    `${UPLOAD_API}/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      body: new Blob([content], { type: mimeType }),
      headers: { 'Content-Type': mimeType },
    }
  );
  return r.json();
}
