/**
 * state.js
 * ────────
 * Satu objek state global yang menjadi sumber kebenaran (single source of truth)
 * untuk seluruh aplikasi. Semua modul membaca/menulis ke objek ini.
 */

const state = {
  // ── Auth ──
  accessToken:    null,   // OAuth2 access token aktif
  tokenClient:    null,   // Google Identity Services token client (lazy-init)
  refreshTimer:   null,   // setTimeout ID untuk silent token refresh
  authInProgress: false,  // guard agar login tidak double-fire
  isSilentRefresh:false,  // flag saat melakukan silent refresh (tanpa popup)

  // ── User ──
  user: null,             // { name, email, picture, sub }

  // ── Database ──
  database:       {},     // { [driveFileId]: { fileName, explanationFileId, history, ... } }
  databaseFileId: null,   // Drive file ID dari database.json

  // ── Navigation ──
  breadcrumb:     [],     // [{ id, name, view }] — jejak navigasi saat ini
  sidebarOpen:    false,  // status sidebar kiri

  // ── Current context ──
  currentFile:         null,  // file yang sedang dipilih (untuk modal opsi)
  currentExplFile:     null,  // file yang penjelasannya sedang ditampilkan
  currentFolderFiles:  [],    // semua berkas (non-folder) di folder yang dibuka, untuk slideshow

  // ── Cache ──
  blobCache:      {},     // { [fileId]: objectURL } — blob lokal untuk preview
  katexLoaded:    false,  // apakah KaTeX + mhchem sudah dimuat

  // ── Editor ──
  editorFile:     null,   // file Drive yang sedang dibuat/diedit penjelasannya
  editorEntry:    null,   // entri database yang berkaitan (null = buat baru)
  editorBlocks:   [],     // array blok konten yang sedang diedit
};
