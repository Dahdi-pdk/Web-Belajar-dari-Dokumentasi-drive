/**
 * auth.js
 * ───────
 * Mengelola seluruh alur autentikasi Google OAuth2 menggunakan
 * Google Identity Services (GIS). Token di-refresh otomatis tiap ~55 menit.
 *
 * Alur:
 *  Login → requestAccessToken() → [popup Google] → handleTokenResponse()
 *       → onLoginSuccess() → fetchUserInfo() + loadDatabase() + renderFolders()
 *
 *  Silent refresh (55 mnt): scheduleRefresh() → requestAccessToken({ prompt:'' })
 *       → handleTokenResponse() → update token (tanpa popup)
 *
 *  Auto-login: tryAutoLogin() di init() → requestAccessToken({ hint: email })
 */

/**
 * Inisialisasi token client GIS (lazy — hanya sekali).
 * @returns {boolean} true jika berhasil
 */
function initTokenClient() {
  if (state.tokenClient) return true;
  if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
    toast('❌ Google Identity Services belum siap.', 'err');
    return false;
  }
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id:      CONFIG.CLIENT_ID,
    scope:          CONFIG.SCOPE,
    callback:       handleTokenResponse,
    error_callback: err => {
      state.authInProgress = false;
      document.getElementById('login-btn').disabled = false;
      log(`Auth error: ${err.type}`, 'error');
    },
  });
  return true;
}

/** Meminta access token baru — membuka popup pemilihan akun Google */
function requestAccessToken() {
  if (state.authInProgress) return;
  if (!initTokenClient()) return;
  state.authInProgress = true;
  document.getElementById('login-btn').disabled = true;
  state.tokenClient.requestAccessToken({ prompt: 'select_account' });
}

/**
 * Callback yang dipanggil GIS setelah token diperoleh/gagal.
 * Menangani baik login awal maupun silent refresh.
 */
function handleTokenResponse(tr) {
  state.authInProgress = false;
  if (tr.error) {
    if (state.isSilentRefresh) {
      state.isSilentRefresh = false;
      log('Sesi habis', 'warning');
      localStorage.removeItem('mkdocs_session');
      forceLogout();
    } else {
      document.getElementById('login-btn').disabled = false;
      toast('❌ Login gagal atau dibatalkan.', 'err');
    }
    return;
  }
  const wasRefresh      = state.isSilentRefresh;
  state.isSilentRefresh = false;
  state.accessToken     = tr.access_token;
  scheduleRefresh(tr.expires_in ?? 3600);
  if (!wasRefresh) {
    document.getElementById('login-btn').disabled = false;
    onLoginSuccess();
  } else {
    log('Token diperbarui otomatis', 'success');
  }
}

/**
 * Jadwalkan silent refresh token 5 menit sebelum kedaluwarsa.
 * @param {number} expiresIn - detik hingga token kedaluwarsa
 */
function scheduleRefresh(expiresIn) {
  if (state.refreshTimer) clearTimeout(state.refreshTimer);
  const delay = Math.max((expiresIn - 300) * 1000, 30_000);
  state.refreshTimer = setTimeout(() => {
    state.isSilentRefresh = true;
    state.tokenClient?.requestAccessToken({ prompt: '' });
  }, delay);
}

/** Paksa logout (token expired / error kritis) */
function forceLogout() {
  state.accessToken = null;
  state.user        = null;
  localStorage.removeItem('mkdocs_session');
  if (state.refreshTimer) clearTimeout(state.refreshTimer);
  document.getElementById('app-header').style.display = 'none';
  closeSidebar();
  showView('login');
  document.getElementById('login-btn').disabled = false;
  toast('⚠️ Sesi berakhir, silakan login kembali.', '');
}

/** Logout manual oleh user */
function logout() {
  const tok = state.accessToken;
  state.accessToken = null;
  state.user        = null;
  localStorage.removeItem('mkdocs_session');
  if (state.refreshTimer) clearTimeout(state.refreshTimer);
  if (tok && google?.accounts?.oauth2) google.accounts.oauth2.revoke(tok, () => {});
  document.getElementById('app-header').style.display = 'none';
  closeSidebar();
  state.breadcrumb = [];
  showView('login');
  log('Logout', 'success');
}
