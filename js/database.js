/**
 * database.js
 * ───────────
 * Mengelola database.json yang disimpan di FOLDER_2 (Drive).
 *
 * Struktur database.json:
 * {
 *   "version": 1,
 *   "entries": {
 *     "[driveFileId]": {
 *       "fileName": "nama-gambar.jpg",
 *       "explanationFileId": "id-file-penjelasan-json",
 *       "explanationFileName": "explanation_XXXX.json",
 *       "createdBy": "email@example.com",
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "updatedAt": "2024-01-02T00:00:00.000Z",
 *       "history": [
 *         {
 *           "action": "create" | "edit",
 *           "name": "Nama User",
 *           "email": "email@example.com",
 *           "picture": "https://...",
 *           "timestamp": "2024-01-01T00:00:00.000Z"
 *         }
 *       ]
 *     }
 *   }
 * }
 */

/** Muat database dari Drive. Buat file baru jika belum ada. */
async function loadDatabase() {
  log('Memuat database...', 'info');
  try {
    const f = await findInFolder(CONFIG.FOLDER_2_ID, CONFIG.DATABASE_FILENAME);
    if (f) {
      state.databaseFileId = f.id;
      const raw = await getFileText(f.id);
      state.database = JSON.parse(raw).entries ?? {};
      log(`Database dimuat: ${Object.keys(state.database).length} entri`, 'success');
    } else {
      log('Database tidak ditemukan, membuat baru...', 'info');
      const created = await createFile(
        CONFIG.FOLDER_2_ID,
        CONFIG.DATABASE_FILENAME,
        JSON.stringify({ version: 1, entries: {} }, null, 2)
      );
      state.databaseFileId = created.id;
      state.database = {};
      log('Database baru dibuat', 'success');
    }
  } catch (e) {
    log(`Gagal load database: ${e.message}`, 'error');
    state.database = {};
  }
}

/** Simpan state.database ke Drive (overwrite database.json). */
async function saveDatabase() {
  const payload = JSON.stringify({ version: 1, entries: state.database }, null, 2);
  if (state.databaseFileId) {
    await updateFile(state.databaseFileId, payload);
  } else {
    const c = await createFile(CONFIG.FOLDER_2_ID, CONFIG.DATABASE_FILENAME, payload);
    state.databaseFileId = c.id;
  }
  log('Database disimpan', 'success');
}

/**
 * Ambil entri database untuk satu file Drive.
 * @param {string} id - Drive file ID
 * @returns {object|null}
 */
const dbGet = id => state.database[id] ?? null;

/**
 * Simpan/update entri database untuk satu file.
 * Mempertahankan history yang sudah ada dan menambahkan historyEntry baru.
 *
 * @param {string} fileId
 * @param {string} fileName
 * @param {string} explanationFileId
 * @param {string} explanationFileName
 * @param {object|null} historyEntry - { action, name, email, picture, timestamp }
 */
async function dbSet(fileId, fileName, explanationFileId, explanationFileName, historyEntry) {
  const existing = state.database[fileId] || {};
  const history  = existing.history || [];
  if (historyEntry) history.push(historyEntry);

  state.database[fileId] = {
    fileName,
    explanationFileId,
    explanationFileName,
    createdBy:  existing.createdBy || historyEntry?.email || null,
    createdAt:  existing.createdAt || new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    history,
  };
  await saveDatabase();
}
