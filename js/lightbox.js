/**
 * lightbox.js
 * ───────────
 * Lightbox fullscreen untuk preview gambar resolusi asli dari Drive.
 *
 * Fitur:
 *  - Zoom in/out dengan tombol, scroll wheel, atau pinch (mobile)
 *  - Drag untuk menggeser gambar (mouse desktop + single-finger touch mobile)
 *  - Zoom origin di titik kursor/pinch, bukan center layar
 *  - Blob cache agar gambar tidak di-download ulang
 *
 * Keyboard: +/= zoom in | - zoom out | 0 reset | Esc tutup
 */

// ── State internal lightbox ───────────────────────────────────────

/** Transform state saat ini */
const lb = { scale: 1, x: 0, y: 0 };

/** State touch (pisah dari mouse agar tidak konflik) */
const lbTouch = {
  active:    false,
  startX:    0,  startY:    0,
  pinching:  false,
  pinchDist: 0,
  pinchMidX: 0,  pinchMidY: 0,
};

// ── Public API ────────────────────────────────────────────────────

/**
 * Buka lightbox dan tampilkan gambar resolusi asli dari Drive.
 * @param {object} file - metadata Drive ({ id, name, ... })
 */
async function openLightbox(file) {
  document.getElementById('lb-title').textContent = file.name;
  document.getElementById('lb-img').src = '';
  lb.scale = 1; lb.x = 0; lb.y = 0;
  applyLb(false);
  document.getElementById('lightbox').classList.add('open');

  showLoad('Memuat gambar...');
  try {
    document.getElementById('lb-img').src = await getFileBlob(file.id);
  } catch (e) {
    toast('❌ Gagal memuat gambar', 'err');
  }
  hideLoad();
}

/** Tutup lightbox */
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

/** Terapkan transform ke elemen img wrapper */
function applyLb(animate = false) {
  const wrap = document.getElementById('lb-img-wrap');
  if (animate) {
    wrap.classList.add('animate');
    setTimeout(() => wrap.classList.remove('animate'), 180);
  }
  wrap.style.transform = `translate(${lb.x}px,${lb.y}px) scale(${lb.scale})`;
  document.getElementById('lb-zoom-txt').textContent = Math.round(lb.scale * 100) + '%';
}

/**
 * Zoom dengan origin di titik (cx, cy) viewport.
 * @param {number} delta - perubahan skala (positif = zoom in)
 * @param {number} [cx]  - X origin (default: center)
 * @param {number} [cy]  - Y origin (default: center)
 */
function lbZoom(delta, cx, cy) {
  const body = document.getElementById('lb-body');
  const rect = body.getBoundingClientRect();
  const ox   = (cx ?? rect.left + rect.width  / 2) - rect.left - rect.width  / 2;
  const oy   = (cy ?? rect.top  + rect.height / 2) - rect.top  - rect.height / 2;
  const prev = lb.scale;
  lb.scale   = Math.min(7, Math.max(0.3, lb.scale * (1 + delta)));
  const ratio = lb.scale / prev - 1;
  lb.x       -= (ox - lb.x) * ratio;
  lb.y       -= (oy - lb.y) * ratio;
  applyLb();
}

// ── Mouse drag (desktop) ──────────────────────────────────────────

const lbBody = document.getElementById('lb-body');
let _mDrag = false, _mSx = 0, _mSy = 0;

lbBody.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  _mDrag = true; _mSx = e.clientX - lb.x; _mSy = e.clientY - lb.y;
  lbBody.style.cursor = 'grabbing';
});
document.addEventListener('mousemove', e => {
  if (!_mDrag) return;
  lb.x = e.clientX - _mSx;
  lb.y = e.clientY - _mSy;
  applyLb();
});
document.addEventListener('mouseup', () => { _mDrag = false; lbBody.style.cursor = ''; });

// ── Touch (mobile): single-finger drag + two-finger pinch zoom ────

lbBody.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    lbTouch.active   = true;
    lbTouch.pinching = false;
    lbTouch.startX   = e.touches[0].clientX - lb.x;
    lbTouch.startY   = e.touches[0].clientY - lb.y;
  } else if (e.touches.length === 2) {
    lbTouch.active    = false;
    lbTouch.pinching  = true;
    lbTouch.pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    lbTouch.pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    lbTouch.pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: true });

lbBody.addEventListener('touchmove', e => {
  e.preventDefault(); // Wajib: mencegah browser scroll/zoom bawaan
  if (e.touches.length === 1 && lbTouch.active && !lbTouch.pinching) {
    lb.x = e.touches[0].clientX - lbTouch.startX;
    lb.y = e.touches[0].clientY - lbTouch.startY;
    applyLb();
  } else if (e.touches.length === 2 && lbTouch.pinching) {
    const dist  = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const midX  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    lbZoom((dist / lbTouch.pinchDist) - 1, midX, midY);
    lbTouch.pinchDist = dist;
    lbTouch.pinchMidX = midX;
    lbTouch.pinchMidY = midY;
  }
}, { passive: false });

lbBody.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    lbTouch.active = lbTouch.pinching = false;
  } else if (e.touches.length === 1) {
    // Jari kedua diangkat saat pinch — lanjut single drag
    lbTouch.pinching = false;
    lbTouch.active   = true;
    lbTouch.startX   = e.touches[0].clientX - lb.x;
    lbTouch.startY   = e.touches[0].clientY - lb.y;
  }
}, { passive: true });

// ── Scroll wheel zoom (desktop) ───────────────────────────────────

document.getElementById('lightbox').addEventListener('wheel', e => {
  e.preventDefault();
  lbZoom(e.deltaY < 0 ? 0.12 : -0.12, e.clientX, e.clientY);
}, { passive: false });
