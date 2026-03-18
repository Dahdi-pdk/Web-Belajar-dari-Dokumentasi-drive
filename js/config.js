/**
 * config.js
 * ─────────
 * Semua konstanta konfigurasi yang perlu diubah saat deploy.
 * Satu tempat untuk mengubah CLIENT_ID, FOLDER_ID, dsb.
 */

const CONFIG = {
  // Google OAuth2 Client ID dari Google Cloud Console
  CLIENT_ID: '716122564200-2rldfr8hctr0reg0v3ovt9qk02f9icvm.apps.googleusercontent.com',

  // Folder 1 — hanya baca (read-only), berisi subfolder MK dan gambar
  FOLDER_1_ID: '1_O0nwpeeD_5aCX-RkoyyrTGRmCD2roCE',

  // Folder 2 — baca/tulis (read-write), berisi database.json + file penjelasan JSON
  FOLDER_2_ID: '1ykb_FscPljc3pXsei2105l_i7riR_dRp',

  // Nama file database di FOLDER_2
  DATABASE_FILENAME: 'database.json',

  // OAuth2 scope — 'drive' agar bisa baca FOLDER_1 yang tidak dibuat app
  // dan baca/tulis FOLDER_2 untuk database + penjelasan
  SCOPE: 'https://www.googleapis.com/auth/drive',
};
