/**
 * share.js
 * ────────
 * Mengelola bottom-sheet modal untuk berbagi link file.
 * Platform yang didukung: Salin ke clipboard, WhatsApp, Email, Buka langsung.
 */

/**
 * Tampilkan modal bagikan untuk sebuah file.
 * @param {object} file - metadata Drive ({ webViewLink, id, ... })
 */
function showShareModal(file) {
  const link = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
  document.getElementById('share-link-input').value = link;

  const grid  = document.getElementById('share-platforms');
  grid.innerHTML = '';

  const opts = [
    {
      ico: '📋', label: 'Salin',
      fn: () => {
        navigator.clipboard.writeText(link);
        toast('✅ Link disalin!', 'ok');
        closeModal('share-modal');
      },
    },
    {
      ico: '💬', label: 'WhatsApp',
      fn: () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank');
        closeModal('share-modal');
      },
    },
    {
      ico: '✉️', label: 'Email',
      fn: () => {
        window.open(`mailto:?body=${encodeURIComponent(link)}`);
        closeModal('share-modal');
      },
    },
    {
      ico: '🔗', label: 'Buka',
      fn: () => {
        window.open(link, '_blank');
        closeModal('share-modal');
      },
    },
  ];

  opts.forEach(o => {
    const btn       = document.createElement('button');
    btn.className   = 'share-plat';
    btn.innerHTML   = `<span class="share-plat-icon">${o.ico}</span>${o.label}`;
    btn.addEventListener('click', o.fn);
    grid.appendChild(btn);
  });

  openModal('share-modal');
}
