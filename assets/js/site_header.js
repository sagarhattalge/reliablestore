// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

// Edge function endpoint (deployed) — adjust if different
const CHECK_IDENTIFIER_ENDPOINT = (supabase?.supabaseUrl || 'https://gugcnntetqarewwnzrki.supabase.co').replace(/\/$/, '') + '/functions/v1/check-identifier';
const SUPABASE_ANON_KEY = supabase?.supabaseKey || '';

// Prevent accidental auto-open
window.__rs_block_auto_modal = true;

/* small helpers */
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

function readCart() {
  try { return JSON.parse(localStorage.getItem('rs_cart_v1') || '{}'); }
  catch(e) { return {}; }
}
function cartTotalCount() {
  const c = readCart();
  return Object.values(c).reduce((s, i) => s + (i.qty || 0), 0);
}
function setCartCount(n) {
  const el1 = document.getElementById('cart-count');
  const el2 = document.getElementById('cart_count');
  if (el1) el1.innerText = String(n || 0);
  if (el2) el2.innerText = String(n || 0);
}

/* modal accessibility helpers */
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = true; } catch (e) { main.setAttribute('aria-hidden', 'true'); }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = false; } catch (e) { main.removeAttribute('aria-hidden'); }
}

/* modal open/close — Option B (no outside click close) */
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) return;
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.style.display = 'flex';
  m.style.alignItems = 'center';
  m.style.justifyContent = 'center';
  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');
  _disablePageForModal();
  setTimeout(() => {
    const input = m.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (input) { try { input.focus(); } catch (_) {} }
  }, 80);
}
function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  m.style.display = 'none';
  _restorePageAfterModal();
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  if (toggle) try { toggle.focus(); } catch (_) {}
}

/* show/hide steps (fix display to avoid "white strip") */
function showStep(id) {
  $all('.rs-step').forEach(s => { s.classList.add('hidden'); s.style.display = 'none'; });
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
}

/* Supabase auth helpers */
async function signInWithPassword(email, password) {
  try { return await supabase.auth.signInWithPassword({ email, password }); }
  catch (e) { return { error: e }; }
}
async function signUpWithEmail(email, password, metadata = {}) {
  try { return await supabase.auth.signUp({ email, password, options: { data: metadata }}); }
  catch (e) { return { error: e }; }
}

/* Edge function check (server-side fetch via Edge Function) */
async function checkExistingByEmail(identifier) {
  try {
    if (!CHECK_IDENTIFIER_ENDPOINT) return null;
    const payload = { identifier: String(identifier || '') };
    const headers = { 'Content-Type': 'application/json' };
    if (SUPABASE_ANON_KEY) headers['apikey'] = SUPABASE_ANON_KEY;
    const res = await fetch(CHECK_IDENTIFIER_ENDPOINT, {
      method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit', headers, body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let bodyText = '<no body>';
      try { bodyText = await res.text(); } catch (e) {}
      console.warn('check-identifier endpoint non-OK', res.status, bodyText);
      return null;
    }
    const json = await res.json().catch(() => null);
    if (!json || typeof json.exists !== 'boolean') { console.warn('check-identifier: unexpected response', json); return null; }
    return json;
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}
window.checkExistingByEmail = checkExistingByEmail;

/* modal wiring */
function setupAuthModal() {
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const modal = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) return;

  modal.style.position = modal.style.position || 'fixed';
  modal.style.inset = modal.style.inset || '0';
  modal.style.display = modal.style.display || 'none';
  modal.style.zIndex = modal.style.zIndex || '1200';
  modal.style.alignItems = modal.style.alignItems || 'center';
  modal.style.justifyContent = modal.style.justifyContent || 'center';

  // elements
  const identifierInput = document.getElementById('rs-identifier');
  const identifierNext  = document.getElementById('rs-identifier-next');
  const identifierError  = document.getElementById('rs-identifier-error');

  const knownEmailText  = document.getElementById('rs-known-email');
  const passwordInput   = document.getElementById('rs-password');
  const signinBtn       = document.getElementById('rs-signin-btn');
  const passwordError   = document.getElementById('rs-password-error');

  const backToEnter     = document.getElementById('rs-back-to-enter');

  const signupEmail     = document.getElementById('rs-signup-email');
  const signupName      = document.getElementById('rs-signup-name');
  const signupPassword  = document.getElementById('rs-signup-password');
  const signupBtn       = document.getElementById('rs-signup-btn');
  const signupError     = document.getElementById('rs-signup-error');
  const cancelSignup    = document.getElementById('rs-cancel-signup');

  const acceptTermsChk  = document.getElementById('rs-accept-terms');
  const confirmationTxt = document.getElementById('rs-signup-confirmation');

  // close controls (buttons with data-rs-close, excluding backdrop since backdrop no longer has that attribute)
  const closeBtns = $all('[data-rs-close]');

  // open toggle
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    openModal({ force: true });
    showStep('rs-step-enter');
    if (identifierInput) { identifierInput.value = ''; identifierInput.focus(); }
    if (identifierError) identifierError.textContent = '';
  });

  // close buttons wiring
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    closeModal();
  }));

  // ESC to close
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // back
  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch (_) {} showStep('rs-step-enter'); });

  // identifier -> decide flow
  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (identifierError) identifierError.textContent = '';
      const raw = (identifierInput?.value || '').trim();
      if (!raw) { if (identifierError) identifierError.textContent = 'Please enter your email or mobile number'; return; }

      if (/^\d{10,}$/.test(raw)) {
        identifierNext.disabled = true;
        const res = await checkExistingByEmail(raw);
        identifierNext.disabled = false;
        if (!res) { if (identifierError) identifierError.textContent = 'Unable to check right now'; return; }
        if (res.exists && res.email) {
          if (knownEmailText) knownEmailText.textContent = res.email;
          if (passwordInput) passwordInput.value = '';
          showStep('rs-step-password');
          return;
        } else if (res.exists) {
          showStep('rs-step-password');
          return;
        } else {
          if (signupEmail) signupEmail.value = '';
          if (signupName) signupName.value = '';
          if (signupPassword) signupPassword.value = '';
          showStep('rs-step-signup');
          signupEmail && signupEmail.focus();
          if (signupBtn) signupBtn.disabled = true;
          return;
        }
      }

      const email = raw;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (identifierError) identifierError.textContent = 'Please enter a valid email address'; return; }

      identifierNext.disabled = true;
      const res = await checkExistingByEmail(email);
      identifierNext.disabled = false;
      if (!res) { if (identifierError) identifierError.textContent = 'Unable to check right now'; return; }

      if (res.exists) {
        if (knownEmailText) knownEmailText.textContent = res.email || email;
        if (passwordInput) passwordInput.value = '';
        showStep('rs-step-password');
        if (passwordError) passwordError.textContent = '';
      } else {
        if (signupEmail) signupEmail.value = email;
        if (signupName) signupName.value = '';
        if (signupPassword) signupPassword.value = '';
        showStep('rs-step-signup');
        signupPassword && signupPassword.focus();
        if (signupBtn) signupBtn.disabled = true;
      }
    } catch (err) {
      console.error('identifierNext handler error', err);
      if (identifierError) identifierError.textContent = 'Unexpected error. Check console.';
    }
  });

  // sign in
  if (signinBtn) signinBtn.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (passwordError) passwordError.textContent = '';
      const email = (knownEmailText?.textContent || '').trim();
      const pw = (passwordInput?.value || '').trim();
      if (!email || !pw) { if (passwordError) passwordError.textContent = 'Enter your password'; return; }

      signinBtn.disabled = true;
      const res = await signInWithPassword(email, pw);
      signinBtn.disabled = false;
      if (res.error) { if (passwordError) passwordError.textContent = res.error.message || 'Sign in failed'; return; }

      try {
        if (!res.error && res.data?.session) {
          await supabase.auth.setSession({
            access_token: res.data.session.access_token,
            refresh_token: res.data.session.refresh_token
          });
        }
      } catch (e) { console.warn('setSession after sign-in failed', e); }

      closeModal();
      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    } catch (err) {
      console.error('signin handler error', err);
      if (passwordError) passwordError.textContent = 'Unexpected error. See console.';
      try { signinBtn.disabled = false; } catch (_) {}
    }
  });

  // enable signup button only after checkbox + fields valid
  const validateEnableSignup = () => {
    if (!signupBtn) return;
    const email = (signupEmail?.value || '').trim();
    const name  = (signupName?.value || '').trim();
    const pw    = (signupPassword?.value || '').trim();
    const checked = !!(acceptTermsChk?.checked);
    signupBtn.disabled = !(email && name && pw.length >= 6 && checked);
  };
  acceptTermsChk && acceptTermsChk.addEventListener('change', validateEnableSignup);
  signupEmail && signupEmail.addEventListener('input', validateEnableSignup);
  signupName && signupName.addEventListener('input', validateEnableSignup);
  signupPassword && signupPassword.addEventListener('input', validateEnableSignup);

  // signup -> show confirmation step (do not auto-close)
  if (signupBtn) signupBtn.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (signupError) signupError.textContent = '';
      const email = (signupEmail?.value || '').trim();
      const name = (signupName?.value || '').trim();
      const pw = (signupPassword?.value || '').trim();
      if (!email || !name || !pw) { if (signupError) signupError.textContent = 'Fill name, email and password'; return; }
      if (pw.length < 6) { if (signupError) signupError.textContent = 'Password must be at least 6 characters'; return; }
      if (!acceptTermsChk?.checked) { if (signupError) signupError.textContent = 'You must accept terms to create account'; return; }

      signupBtn.disabled = true;
      const res = await signUpWithEmail(email, pw, { full_name: name });
      signupBtn.disabled = false;
      if (res.error) { if (signupError) signupError.textContent = res.error.message || 'Signup failed'; return; }

      // show confirmation message (do not close automatically)
      if (confirmationTxt) {
        confirmationTxt.textContent = `We sent a confirmation email to ${email}. Click the link in that email to activate your account. Check spam if you don't see it.`;
      }
      showStep('rs-step-confirmation');

      // disable inputs to prevent accidental re-submission
      if (signupEmail) signupEmail.disabled = true;
      if (signupName) signupName.disabled = true;
      if (signupPassword) signupPassword.disabled = true;
      if (acceptTermsChk) acceptTermsChk.disabled = true;
    } catch (err) {
      console.error('signup handler error', err);
      if (signupError) signupError.textContent = 'Unexpected error. See console.';
      try { signupBtn.disabled = false; } catch (_) {}
    }
  });

  if (cancelSignup) cancelSignup.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });
}

/* header extras */
export function renderHeaderExtras() {
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  const toggle = document.getElementById('rs-header-login-toggle');
  const logoutBtn = document.getElementById('rs-logout-btn');

  function setUi(loggedIn) {
    if (toggle) toggle.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
  }

  async function refreshAuthUI() {
    try {
      const userRes = await Promise.race([ supabase.auth.getUser(), new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 6000)) ]);
      const user = userRes?.data?.user || userRes?.user || null;
      setUi(!!user);
      if (user) return;
    } catch (e) { console.warn('supabase.getUser failed/timeout', e); }

    // fallback token check
    try {
      const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token');
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setUi(false); return; }
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      const access_token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.value?.access_token;
      if (!access_token) { setUi(false); return; }
      const url = (supabase.supabaseUrl || '').replace(/\/$/, '') + '/auth/v1/user';
      const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': 'Bearer ' + access_token, 'apikey': supabase.supabaseKey }, mode: 'cors', cache: 'no-store' });
      if (resp.status === 200) setUi(true); else setUi(false);
    } catch (e) { console.warn('fallback token check failed', e); setUi(false); }
  }

  try { supabase.auth.onAuthStateChange(() => { refreshAuthUI().catch((e) => console.warn('refreshAuthUI error', e)); }); } catch (e) {}
  refreshAuthUI().catch((e) => console.warn('initial refreshAuthUI error', e));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      try { e.preventDefault && e.preventDefault(); } catch (_) {}
      try { await supabase.auth.signOut().catch(() => {}); } catch (e) {}
      try { const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token'); localStorage.removeItem(storageKey); } catch(e){}
      try { alert('You have been logged out.'); } catch (e) {}
      window.location.href = '/';
    });
  }
}

/* auto-run */
document.addEventListener('DOMContentLoaded', () => {
  try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
});

// expose open/close for manual testing
window.openModal = openModal;
window.closeModal = closeModal;
