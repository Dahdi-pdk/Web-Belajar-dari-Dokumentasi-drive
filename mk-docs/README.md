# 📚 MK Docs — Dokumentasi Materi Kuliah

Aplikasi web satu halaman (SPA) untuk menampilkan, menelusuri, dan mendokumentasikan materi perkuliahan yang tersimpan di Google Drive. Dibangun dengan HTML/CSS/JS murni (tanpa framework), berjalan seluruhnya di browser.

---

## Struktur Direktori

```
mk-docs/
├── index.html          ← Entry point: struktur HTML semua view & modal
├── css/
│   └── styles.css      ← Seluruh styling aplikasi
└── js/
    ├── config.js       ← Konfigurasi (CLIENT_ID, FOLDER_ID, dsb.)
    ├── state.js        ← State global aplikasi (single source of truth)
    ├── utils.js        ← Fungsi utilitas murni (esc, log, toast, dsb.)
    ├── auth.js         ← Autentikasi Google OAuth2 + token refresh
    ├── api.js          ← Wrapper Google Drive API v3
    ├── database.js     ← Pengelolaan database.json di Drive
    ├── views.js        ← Navigasi view + breadcrumb
    ├── folders.js      ← Grid folder MK, grid file, modal opsi
    ├── lightbox.js     ← Preview gambar fullscreen (zoom + drag)
    ├── slideshow.js    ← Mode slideshow presentasi
    ├── explanation.js  ← Halaman penjelasan + editor blok + renderer blok
    ├── share.js        ← Modal bagikan link
    ├── user.js         ← Info user, sidebar, halaman akun, riwayat
    └── main.js         ← Entry point JS: init(), event listeners, auto-login
```

---

## Cara Kerja Keseluruhan

```
Browser membuka index.html
    ↓
HTML + CSS dimuat → DOMContentLoaded
    ↓
main.js init() dipanggil
    ↓
tryAutoLogin() → cek localStorage
    ├── Ada sesi tersimpan → silent token request (tanpa popup)
    └── Tidak ada → tampilkan halaman login

User klik Login
    ↓
auth.js requestAccessToken() → popup Google (pilih akun + izin Drive)
    ↓
handleTokenResponse() → simpan access token → scheduleRefresh(55 mnt)
    ↓
onLoginSuccess()
    ├── fetchUserInfo()   → ambil nama/email/foto dari Google API
    ├── loadDatabase()    → baca/buat database.json dari FOLDER_2
    └── renderFolders()   → tampilkan grid folder dari FOLDER_1
```

---

## Penjelasan Setiap File

### `index.html`
Entry point HTML. Mendefinisikan semua elemen DOM yang digunakan seluruh aplikasi:
- Loading overlay & toast
- Sidebar kiri (navigasi mobile)
- Header sticky (burger + breadcrumb + avatar)
- **7 view** yang saling bergantian: `login`, `folders`, `files`, `explanation`, `account`, `history`, `editor`
- 2 modal bottom-sheet: `options-modal`, `share-modal`
- 2 overlay fullscreen: `lightbox`, `slideshow`
- Debug panel tersembunyi (tombol 🐛)
- Tag `<script>` dalam urutan yang benar (lihat bagian Urutan Script)

---

### `css/styles.css`
Semua styling dalam satu file, dibagi per seksi dengan komentar `/* ===== ... ===== */`:

| Seksi | Deskripsi |
|---|---|
| Design Tokens | CSS variables: warna, shadow, radius, transition |
| Loading / Skeleton | Overlay loading + shimmer animation |
| Header | Sticky header, breadcrumb, burger button |
| Views | `.view` base class + animasi fadeUp |
| Login | Card login terpusat |
| Section Header | Judul halaman + badge jumlah |
| Grid | Responsive auto-fill grid untuk folder/file card |
| Folder Card | Card folder dengan thumbnail + hover overlay |
| File Card | Card file dengan badge "Ada penjelasan" |
| Buttons | Semua varian tombol (.btn-primary, .btn-ghost, dsb.) |
| Bottom Sheet | Modal slide-up dari bawah |
| Lightbox | Fullscreen preview gambar |
| Slideshow | Fullscreen presentasi slide |
| Explanation View | Halaman penjelasan: gambar sumber, blok konten |
| Block Rendering | Style untuk setiap tipe blok (heading, math, code, dsb.) |
| Block Editor | UI editor blok visual |
| Share Modal | Grid platform berbagi |
| Toast | Notifikasi sementara |
| Sidebar | Panel navigasi kiri |
| Account Page | Halaman profil user + statistik |
| History Page | Daftar riwayat pengeditan |

---

### `js/config.js`
**Satu-satunya file yang perlu diubah saat deploy ke environment berbeda.**

```js
const CONFIG = {
  CLIENT_ID:    '...',  // Google Cloud Console → API & Services → Credentials
  FOLDER_1_ID:  '...',  // ID folder gambar (read-only)
  FOLDER_2_ID:  '...',  // ID folder database + penjelasan (read-write)
  DATABASE_FILENAME: 'database.json',
  SCOPE: 'https://www.googleapis.com/auth/drive',
};
```

**Cara mendapatkan FOLDER_ID:** Buka folder di Google Drive → salin ID dari URL:
`https://drive.google.com/drive/folders/[FOLDER_ID_DI_SINI]`

---

### `js/state.js`
Objek `state` adalah satu-satunya sumber data global (single source of truth). Semua modul membaca dan menulis ke objek ini. Tidak ada state tersembunyi di dalam fungsi-fungsi lain.

| Property | Tipe | Keterangan |
|---|---|---|
| `accessToken` | string\|null | OAuth2 token aktif |
| `tokenClient` | object\|null | GIS TokenClient (lazy init) |
| `user` | object\|null | `{ name, email, picture, sub }` |
| `database` | object | Isi database.json yang dimuat |
| `breadcrumb` | array | Stack navigasi `[{ id, name, view }]` |
| `currentFolderFiles` | array | File di folder aktif (untuk slideshow) |
| `blobCache` | object | `{ fileId: objectURL }` |
| `editorBlocks` | array | Blok yang sedang diedit |

---

### `js/utils.js`
Fungsi murni tanpa efek samping kompleks:

| Fungsi | Keterangan |
|---|---|
| `esc(s)` | Escape HTML (anti-XSS) |
| `isImg(mime)` | Apakah MIME type gambar? |
| `isFld(mime)` | Apakah Google Drive folder? |
| `mimeLabel(mime)` | Label teks (misal: "PDF", "Google Docs") |
| `mimeIcon(mime)` | Emoji ikon sesuai tipe file |
| `log(msg, type)` | Tulis ke debug panel + console |
| `toast(msg, type)` | Notifikasi sementara 3 detik |
| `showLoad(txt)` | Tampilkan overlay loading |
| `hideLoad()` | Sembunyikan overlay loading |

---

### `js/auth.js`
Mengelola seluruh alur OAuth2 via Google Identity Services (GIS).

**Alur login:**
```
requestAccessToken()
  → initTokenClient() [lazy, sekali saja]
  → tokenClient.requestAccessToken({ prompt: 'select_account' })
      ↓
handleTokenResponse(tr)
  → simpan access token
  → scheduleRefresh(expiresIn - 5 mnt)
  → onLoginSuccess()
```

**Silent refresh (otomatis tiap ~55 menit):**
```
scheduleRefresh() → setTimeout → requestAccessToken({ prompt: '' })
  → handleTokenResponse() → token baru, reschedule
```

**Jika gagal:** `forceLogout()` → hapus localStorage → kembali ke halaman login.

---

### `js/api.js`
Wrapper untuk Google Drive API v3. Semua request melewati `driveReq()` yang:
- Menyisipkan `Authorization: Bearer {token}` otomatis
- Menangani HTTP 401 → panggil `forceLogout()`
- Melempar `Error` dengan pesan yang jelas untuk error lainnya

| Fungsi | Keterangan |
|---|---|
| `driveReq(path, opts)` | Base fetcher dengan auth header |
| `listFolder(folderId)` | Daftar file dalam folder |
| `getFileText(fileId)` | Download file sebagai teks |
| `getFileBlob(fileId)` | Download file sebagai Blob (ter-cache) |
| `findInFolder(folderId, name)` | Cari file berdasarkan nama |
| `createFile(folderId, name, content)` | Buat file baru |
| `updateFile(fileId, content)` | Update isi file |

---

### `js/database.js`
Mengelola `database.json` yang disimpan di FOLDER_2.

**Struktur database.json:**
```json
{
  "version": 1,
  "entries": {
    "[driveFileId]": {
      "fileName": "nama-gambar.jpg",
      "explanationFileId": "id-file-json-penjelasan",
      "explanationFileName": "explanation_XXXX.json",
      "createdBy": "email@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z",
      "history": [
        {
          "action": "create",
          "name": "Nama User",
          "email": "email@example.com",
          "picture": "https://...",
          "timestamp": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  }
}
```

| Fungsi | Keterangan |
|---|---|
| `loadDatabase()` | Baca database.json dari Drive, buat baru jika tidak ada |
| `saveDatabase()` | Tulis state.database ke Drive |
| `dbGet(fileId)` | Ambil entri untuk satu file |
| `dbSet(fileId, ...)` | Simpan/update entri + append riwayat |

---

### `js/views.js`
Mengatur navigasi antar halaman dan breadcrumb.

- `showView(name)` — Sembunyikan semua view, tampilkan satu yang dituju
- `updateBreadcrumb()` — Render ulang breadcrumb di header dan sidebar

---

### `js/folders.js`
Mengelola dua halaman utama browsing konten.

**Halaman Folder (`view-folders`):**
- `renderFolders()` — Ambil subfolder dari FOLDER_1, render kartu
- `makeFolderCard(folder, onClick)` — Buat elemen DOM satu kartu folder
- `loadFolderThumb(folderId)` — Muat thumbnail (gambar pertama) secara lazy

**Halaman File (`view-files`):**
- `openFolder(folderId, name)` — Buka folder, tampilkan skeleton → render kartu file
- `makeFileCard(file)` — Kartu file + badge "Ada penjelasan" dari database

**Modal Opsi:**
- `showOptions(file)` — Bottom-sheet dengan aksi sesuai tipe file:
  - Gambar: Preview / Lihat Penjelasan atau Tambah / Edit / Bagikan
  - File lain: Lihat di Drive / Lihat Penjelasan atau Tambah / Edit / Bagikan

---

### `js/lightbox.js`
Preview gambar fullscreen dengan kontrol transform CSS.

**State internal:**
```js
const lb = { scale, x, y };      // transform saat ini
const lbTouch = { active, startX, startY, pinching, pinchDist, ... };
```

**Input yang didukung:**
| Input | Aksi |
|---|---|
| Mouse drag | Pan gambar |
| Scroll wheel | Zoom in/out di posisi kursor |
| 1 jari (touch) | Pan gambar |
| 2 jari (pinch) | Zoom in/out di titik tengah jari |
| Tombol +/- | Zoom in/out |
| Tombol 0 | Reset zoom |
| Esc | Tutup |

**Catatan teknis:** `touch-action: none` pada container dan `{ passive: false }` pada `touchmove` wajib agar browser tidak menginterferensi.

---

### `js/slideshow.js`
Mode presentasi fullscreen untuk semua berkas dalam folder.

**Navigasi:**
- Tombol ‹ / ›
- Swipe kiri/kanan (≥45px threshold)
- Keyboard ←/→ atau ↑/↓
- Klik dot indicator (untuk folder ≤30 file)

**Strategi gambar:** Tampilkan thumbnail Drive segera, lalu muat versi `=s1600` di background dan ganti saat siap (menghilangkan blur tanpa delay tampilan awal).

---

### `js/explanation.js`
File terpanjang — mengelola halaman penjelasan + seluruh sistem editor blok.

**Halaman Penjelasan (`openExplanation`):**
1. Unduh file JSON penjelasan dari Drive
2. Render gambar sumber resolusi asli (blob via `getFileBlob`)
3. Render blok konten via `renderBlocks`
4. Render riwayat pengeditan di section tersembunyi

**Tipe Blok yang Didukung:**

| Tipe | Keterangan | Data |
|---|---|---|
| `heading` | H1/H2/H3 | `{ level, content }` |
| `paragraph` | Teks dengan HTML dasar | `{ content }` |
| `math` | Rumus LaTeX/KaTeX | `{ content }` |
| `code` | Blok kode dengan bahasa | `{ language, content }` |
| `list` | Daftar poin/bernomor | `{ ordered, items[] }` |
| `image` | Gambar dari URL eksternal | `{ url, caption }` |
| `embed` | YouTube/Instagram/Twitter/TikTok/Drive | `{ url, caption }` |
| `callout` | Kotak pesan berwarna | `{ variant, content }` |
| `divider` | Garis pemisah | — |

**KaTeX (lazy load):** Dimuat hanya jika ada blok `math`. Mendukung:
- Matematika: `$...$` inline, `$$...$$` display
- Kimia: `\ce{H2SO4}`, `\ce{CO2 + H2O -> H2CO3}`
- Fisika: `\vec{F}`, `\dv{x}{t}`, `\pdv{E}{x}`

**Format file penjelasan JSON:**
```json
{
  "fileId": "drive-file-id",
  "fileName": "nama-gambar.jpg",
  "title": "Judul Penjelasan",
  "blocks": [ { "type": "heading", "level": 1, "content": "..." }, ... ],
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "history": [ { "action": "create", "name": "...", "email": "...", ... } ]
}
```

**Editor Blok (`openEditor`):**
- Setiap blok punya toolbar: ↑ naik, ↓ turun, 🗑 hapus
- Zone "+ Tambah blok di bawah" di setiap blok
- `saveExplanation()` — simpan ke Drive + update database.json + append riwayat

---

### `js/share.js`
Bottom-sheet modal berbagi link. Platform: Salin ke clipboard, WhatsApp, Email, Buka langsung.

---

### `js/user.js`
Mengelola identitas user dan halaman-halaman terkait.

**`fetchUserInfo()`** — Panggil `oauth2/v3/userinfo` setelah login, simpan ke `state.user` dan localStorage.

**Sidebar (`openSidebar/closeSidebar/toggleSidebar`):**
- Slide in dari kiri dengan overlay gelap
- Berisi: user row (klikable → halaman akun), nav menu, breadcrumb lokasi saat ini
- Menutup otomatis saat klik overlay atau Esc

**`openAccount()`** — Halaman profil dengan statistik dari database:
- Penjelasan yang dibuat oleh user ini
- Total edit oleh user ini
- Total file terdaftar di database

**`openHistory()` / `renderHistoryList(filter)`** — Halaman riwayat global semua pengeditan, bisa difilter Semua/Dibuat/Diedit.

---

### `js/main.js`
Entry point JavaScript. Dipanggil oleh `DOMContentLoaded`.

**`init()`** — Wire semua event listener statik (tombol, keyboard, sidebar, modal, filter).

**`onLoginSuccess()`** — Urutan setelah login berhasil:
```
fetchUserInfo() → loadDatabase() → renderFolders()
```

**`tryAutoLogin()`** — Coba login otomatis dari sesi tersimpan (maks 7 hari):
```
localStorage 'mkdocs_session' ada?
  → Ya: requestAccessToken({ prompt: '', hint: email }) [tanpa popup]
  → Tidak: tampilkan halaman login
```

---

## Setup & Deploy

### Prasyarat
1. Google Chrome / browser modern
2. Web server (tidak bisa dibuka via `file://`)
3. Google Cloud Project dengan Drive API aktif

### Langkah Setup

**1. Aktifkan Google Drive API:**
- Buka [console.cloud.google.com](https://console.cloud.google.com)
- APIs & Services → Library → "Google Drive API" → Enable

**2. Buat OAuth2 Client ID:**
- APIs & Services → Credentials → Create Credentials → OAuth Client ID
- Application type: **Web application**
- Authorized JavaScript Origins: tambahkan domain Anda (contoh: `https://mkdocs.netlify.app`)
- Salin Client ID ke `js/config.js`

**3. Konfigurasi OAuth Consent Screen:**
- APIs & Services → OAuth consent screen
- Publish App (ubah dari "Testing" ke "In production")
- Scope yang dipakai: `drive` (sensitive scope, user akan lihat warning)

**4. Persiapkan Google Drive:**
- Buat 2 folder di Drive:
  - **Folder 1** (read-only): untuk subfolder MK yang berisi gambar
  - **Folder 2** (read-write): untuk database.json + file penjelasan
- Salin ID kedua folder ke `js/config.js`
- Share Folder 1 ke "Anyone with link" (Viewer) opsional, atau biarkan private

**5. Deploy:**
- Upload seluruh folder `mk-docs/` ke hosting statis
- Rekomendasi: Netlify (drag & drop), GitHub Pages, Cloudflare Pages
- Setelah deploy, tambahkan URL production ke Authorized JavaScript Origins di Google Cloud Console

### Menjalankan Secara Lokal
```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```
Buka `http://localhost:8000`

---

## Arsitektur Data

```
Google Drive
├── FOLDER_1 (gambar, read-only)
│   ├── Kimia Dasar/
│   │   ├── reaksi-redoks.jpg
│   │   ├── tabel-periodik.png
│   │   └── ...
│   ├── Fisika/
│   │   └── ...
│   └── ...
│
└── FOLDER_2 (database + penjelasan, read-write)
    ├── database.json                    ← Indeks semua penjelasan
    ├── explanation_[fileId1].json       ← Penjelasan untuk reaksi-redoks.jpg
    ├── explanation_[fileId2].json       ← Penjelasan untuk tabel-periodik.png
    └── ...
```

---

## Alur Edit & Riwayat

```
User klik file → showOptions()
  → "Tambah Penjelasan" atau "Edit Penjelasan" → openEditor()
      ↓
User edit blok → klik Simpan → saveExplanation()
  ↓
1. Buat histEntry = { action, name, email, picture, timestamp }
2. Baca history lama dari file JSON penjelasan
3. Append histEntry ke history
4. Tulis file JSON penjelasan baru ke FOLDER_2 via updateFile()/createFile()
5. Update database.json via dbSet() dengan histEntry yang sama
  ↓
Riwayat tersimpan di DUA tempat:
  - File penjelasan JSON (untuk ditampilkan di halaman penjelasan)
  - database.json (untuk ditampilkan di halaman riwayat global)
```

---

## Keyboard Shortcuts

| Konteks | Tombol | Aksi |
|---|---|---|
| Lightbox | `+` / `=` | Zoom in |
| Lightbox | `-` | Zoom out |
| Lightbox | `0` | Reset zoom |
| Slideshow | `→` / `↓` | Slide berikutnya |
| Slideshow | `←` / `↑` | Slide sebelumnya |
| Global | `Esc` | Tutup lightbox / slideshow / sidebar / modal |

---

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---|---|---|
| "Google Identity Services belum siap" | Script GIS belum dimuat | Pastikan `https://accounts.google.com/gsi/client` dapat diakses |
| "403 redirect_uri_mismatch" | Origin tidak terdaftar | Tambahkan domain ke Authorized JavaScript Origins di Google Cloud |
| Gambar tidak tampil di penjelasan | CORS atau URL salah | Gunakan URL langsung ke file gambar, bukan halaman web |
| Auto-login tidak berfungsi | Cookie/localStorage diblokir | Pastikan browser mengizinkan localStorage |
| Thumbnail folder blur | Drive thumbnail resolusi rendah | Klik gambar untuk membuka lightbox resolusi asli |
| App tidak bisa dibuka via `file://` | GIS tidak mendukung origin `null` | Jalankan via web server lokal |
