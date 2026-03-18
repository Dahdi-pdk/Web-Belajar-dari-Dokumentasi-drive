/**
 * slideshow.js
 * ────────────
 * Slideshow fullscreen untuk menampilkan semua berkas dalam sebuah folder
 * layaknya presentasi. Gambar ditampilkan langsung; file lain dengan ikon besar.
 *
 * Fitur:
 *  - Navigasi tombol ‹ / › atau swipe kiri/kanan (mobile)
 *  - Keyboard: ← ↑ / → ↓ / Esc
 *  - Dot indicator (untuk ≤ 30 file)
 *  - Thumbnail tampil cepat, upgrade ke resolusi lebih tinggi di background
 *  - Tombol ⋯ Opsi membuka modal opsi yang sama dengan grid view
 */

// ── State internal slideshow ──────────────────────────────────────

const ss = {
  files:   [],    // semua file non-folder di folder saat ini
  idx:     0,     // indeks slide aktif
  swipeX:  0,     // X awal swipe touch
  swiping: false,
};

// ── Public API ────────────────────────────────────────────────────

/**
 * Buka slideshow.
 * @param {Array}  files    - array file metadata Drive
 * @param {number} startIdx - indeks slide awal
 */
function openSlideshow(files, startIdx = 0) {
  ss.files = files;
  ss.idx   = startIdx;
  document.getElementById('slideshow').classList.add('open');
  renderSlide(ss.idx);
  buildSsDots();
}

/** Tutup slideshow dan hapus slide dari DOM */
function closeSlideshow() {
  document.getElementById('slideshow').classList.remove('open');
  document.getElementById('ss-body').querySelectorAll('.ss-slide').forEach(el => el.remove());
}

/**
 * Render slide ke-idx.
 * @param {number} idx - indeks target
 * @param {number} dir - arah animasi: -1 (kiri), 0 (tidak), +1 (kanan)
 */
function renderSlide(idx, dir = 0) {
  const ssBody = document.getElementById('ss-body');
  ssBody.querySelectorAll('.ss-slide').forEach(el => el.remove());

  const file  = ss.files[idx];
  const slide = document.createElement('div');
  slide.className = 'ss-slide';

  if (isImg(file.mimeType)) {
    const img   = document.createElement('img');
    img.src     = file.thumbnailLink || '';
    img.alt     = file.name;
    img.loading = 'eager';
    // Muat versi resolusi lebih tinggi di background
    if (file.thumbnailLink) {
      const hires    = new Image();
      hires.onload   = () => { img.src = hires.src; };
      hires.src      = file.thumbnailLink.replace('=s220', '=s1600');
    }
    slide.appendChild(img);
  } else {
    const ico       = document.createElement('div');
    ico.className   = 'ss-slide-icon';
    ico.textContent = mimeIcon(file.mimeType);
    slide.appendChild(ico);
  }

  const name       = document.createElement('div');
  name.className   = 'ss-slide-name';
  name.textContent = file.name;
  slide.appendChild(name);
  ssBody.insertBefore(slide, ssBody.querySelector('.ss-arrow.next'));

  // Animasi masuk
  if (dir !== 0) {
    slide.style.transform = `translateX(${dir * 60}px)`;
    slide.style.opacity   = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slide.style.transform = '';
      slide.style.opacity   = '1';
    }));
  }

  document.getElementById('ss-title').textContent   = file.name;
  document.getElementById('ss-counter').textContent = `${idx + 1} / ${ss.files.length}`;
  document.querySelectorAll('.ss-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

/** Buat dot indicator di footer slideshow */
function buildSsDots() {
  const container = document.getElementById('ss-dots');
  container.innerHTML = '';
  // Tampilkan dot hanya jika ≤ 30 file (lebih dari itu terlalu penuh)
  if (ss.files.length <= 30) {
    ss.files.forEach((_, i) => {
      const dot       = document.createElement('button');
      dot.className   = `ss-dot${i === ss.idx ? ' active' : ''}`;
      dot.addEventListener('click', () => { ss.idx = i; renderSlide(i); });
      container.appendChild(dot);
    });
  }
}

/**
 * Pindah ke slide berikutnya/sebelumnya.
 * @param {1|-1} dir
 */
function ssGo(dir) {
  const next = (ss.idx + dir + ss.files.length) % ss.files.length;
  ss.idx = next;
  renderSlide(next, dir);
}

// ── Event listeners slideshow ─────────────────────────────────────

// Swipe horizontal (mobile)
const ssBodyEl = document.getElementById('ss-body');
ssBodyEl.addEventListener('touchstart', e => {
  if (e.touches.length === 1) { ss.swipeX = e.touches[0].clientX; ss.swiping = true; }
}, { passive: true });
ssBodyEl.addEventListener('touchend', e => {
  if (!ss.swiping) return;
  const dx = e.changedTouches[0].clientX - ss.swipeX;
  if (Math.abs(dx) > 45) ssGo(dx < 0 ? 1 : -1);
  ss.swiping = false;
}, { passive: true });

// Tombol navigasi
document.getElementById('ss-prev').addEventListener('click', () => ssGo(-1));
document.getElementById('ss-next').addEventListener('click', () => ssGo(1));
document.getElementById('ss-close').addEventListener('click', closeSlideshow);

// Tombol opsi — buka modal opsi untuk file saat ini
document.getElementById('ss-options-btn').addEventListener('click', () => {
  if (ss.files[ss.idx]) showOptions(ss.files[ss.idx]);
});
