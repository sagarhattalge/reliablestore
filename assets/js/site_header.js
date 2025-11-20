// assets/js/site_header.js
// Header + Auth modal client script for ReliableStore
// - Uses Supabase client (imported from /assets/js/supabase_client.js)
// - Calls Supabase Edge Function CHECK_IDENTIFIER_ENDPOINT via POST and sends both `apikey` and `Authorization` headers
// - Keeps service-role keys on server (Edge Function)
// - Fixes the "white strip" by toggling element.style.display properly when switching steps
// - Option B behaviour: modal does NOT close when clicking outside; closes only by close button, Cancel, or Escape

import { supabase } from '/assets/js/supabase_client.js';

// Edge function endpoint (deployed). Uses supabase client url if available, otherwise fallback.
const CHECK_IDENTIFIER_ENDPOINT = (supabase?.supabaseUrl || 'https://gugcnntetqarewwnzrki.supabase.co').replace(/\/$/, '') + '/functions/v1/check-identifier';

// Use anon key from client (safe to be public) for the Edge Function call.
// If supabase client exports the key, use that, else fallback to the anon key you provided.
const SUPABASE_ANON_KEY = supabase?.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg';

window.__rs_block_auto_modal = true; // prevent accidental auto-open on page load

/* ---------------- small helpers ---------------- */
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

/* ---------------- modal accessibility helpers ---------------- */
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = true; } catch (e) { main.setAttribute('aria-hidden', 'true'); }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = false; } catch (e) { main.removeAttribute('aria-hidden'); }
}

/* ---------------- modal open/close ---------------- */
/* Option B behavior: do NOT close on outside click (unless you change it later) */
let ignoreDocumentClick = false;

function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    console.debug('openModal blocked by guard');
    return;
  }
  const m = $('#rs-auth-modal');
  if (!m) return;

  // Ensure visual layout and centre modal
  m.style.display = 'flex';
  m.style.alignItems = 'center';
  m.style.justifyContent = 'center';

  // remove hidden flag and expose to assistive tech
  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');

  // inert background for screen readers
  _disablePageForModal();

  // focus first focusable element after small delay
  setTimeout(() => {
    const input = m.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (input) {
      try { input.focus(); } catch (e) {}
    }
  }, 80);

  // prevent immediate outside-click closing due to event ordering (if you decide to add outside-click behaviour)
  ignoreDocumentClick = true;
  setTimeout(() => { ignoreDocumentClick = false; }, 160);
}

function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');

  // hide visually too
  m.style.display = 'none';

  _restorePageAfterModal();

  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  if (toggle) try { toggle.focus(); } catch (e) {}
}

// showStep: accurately show/hide step panels and set inline display, fixing the white-strip problem
function showStep(id) {
  $all('.rs-step').forEach(s => {
    s.classList.add('hidden');
    // also ensure inline display is hidden
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  // Steps are block-level containers in markup — ensure visible
  el.style.display = 'block';
}

/* ---------------- Supabase client helpers (signin/signup) ---------------- */
async function signInWithPassword(email, password) {
  try {
    return await supabase.auth.signInWithPassword({ email, password });
  } catch (e) {
    return { error: e };
  }
}
async function signUpWithEmail(email, password, metadata = {}) {
  try {
    return await supabase.auth.signUp({ email, password, options: { data: metadata }});
  } catch (e) {
    return { error: e };
  }
}

/* ---------------- Edge Function: secure identifier check ----------------
   Calls your deployed Edge Function at CHECK_IDENTIFIER_ENDPOINT.
   The function uses the service role key server-side; browser sends only anon key (apikey header).
   This patched version sends both apikey and Authorization headers and includes verbose logging.
*/
async function checkExistingByEmail(identifier) {
  try {
    if (!CHECK_IDENTIFIER_ENDPOINT) {
      console.warn('CHECK_IDENTIFIER_ENDPOINT not configured');
      return null;
    }

    const payload = { identifier: String(identifier || '') };

    // DEBUG: show endpoint + payload
    console.log('checkExistingByEmail -> calling edge function', CHECK_IDENTIFIER_ENDPOINT, payload);

    const headers = {
      'Content-Type': 'application/json'
    };

    // include anon/apikey header if present (okay to expose anon key)
    if (SUPABASE_ANON_KEY) {
      headers['apikey'] = SUPABASE_ANON_KEY;
      headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
    }

    // DEBUG: show headers we will send (mask sensitive-looking keys)
    console.log('checkExistingByEmail -> sending headers (masked):',
      Object.fromEntries(Object.entries(headers).map(([k,v]) => [k, (k.toLowerCase().includes('key') || k.toLowerCase().includes('authorization')) ? '***MASKED***' : v]))
    );

    const res = await fetch(CHECK_IDENTIFIER_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      // try to read body (JSON/text) for a helpful message
      let bodyText = '<no body>';
      try {
        bodyText = await res.text();
      } catch (e) { /* ignore */ }

      console.warn('check-identifier endpoint non-OK', res.status, bodyText);

      if (res.status === 401) {
        console.warn('401 from function — check that you are sending anon key (not service_role) and that function CORS allows "apikey" and "authorization".');
      }
      return null;
    }

    const json = await res.json().catch(() => null);
    if (!json || typeof json.exists !== 'boolean') {
      console.warn('check-identifier: unexpected response', json);
      return null;
    }

    console.log('checkExistingByEmail -> function response', json);
    return json; // { exists: boolean, email?: string }
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}

// Expose for quick console testing (optional but helpful)
window.checkExistingByEmail = checkExistingByEmail;

/* ---------------- modal wiring ---------------- */
function setupAuthModal() {
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const modal  = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) {
    // if missing, nothing to wire
    return;
  }

  // Defensive visual defaults
  modal.style.position = modal.style.position || 'fixed';
  modal.style.inset = modal.style.inset || '0';
  modal.style.display = modal.style.display || 'none';
  modal.style.zIndex = modal.style.zIndex || '1200';
  modal.style.alignItems = modal.style.alignItems || 'center';
  modal.style.justifyContent = modal.style.justifyContent || 'center';

  // Elements
  const identifierInput = document.getElementById('rs-identifier');
  const identifierNext  = document.getElementById('rs-identifier-next');
  const identifierError = document.getElementById('rs-identifier-error');

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

  const closeBtns       = $all('[data-rs-close]');

  // Open modal (force bypass guard)
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    openModal({ force: true });
    showStep('rs-step-enter');
    if (identifierInput) { identifierInput.value = ''; identifierInput.focus(); }
    if (identifierError) identifierError.textContent = '';
  });

  // Close via close buttons / cancel
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    closeModal();
  }));

  // NOTE: Option B chosen — DO NOT close modal when clicking outside.
  // If you want outside-click-to-close later, add a handler here (use ignoreDocumentClick to avoid race).

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  // Identifier -> determine existing/new using Edge Function
  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}

      if (identifierError) identifierError.textContent = '';
      const raw = (identifierInput?.value || '').trim();
      console.log('identifierNext clicked — raw value:', raw);
      if (!raw) { if (identifierError) identifierError.textContent = 'Please enter your email or mobile number'; return; }

      // phone branch
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
          // exists but no email returned
          showStep('rs-step-password');
          return;
        } else {
          // not found -> signup
          if (signupEmail) signupEmail.value = '';
          if (signupName) signupName.value = '';
          if (signupPassword) signupPassword.value = '';
          showStep('rs-step-signup');
          signupEmail && signupEmail.focus();
          return;
        }
      }

      // email branch
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
      }
    } catch (err) {
      console.error('identifierNext handler error', err);
      if (identifierError) identifierError.textContent = 'Unexpected error. Check console.';
    }
  });

  // Sign in
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
      if (res.error) {
        if (passwordError) passwordError.textContent = res.error.message || 'Sign in failed';
        return;
      }

      // set session if returned
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

  // Sign up
  if (signupBtn) signupBtn.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (signupError) signupError.textContent = '';
      const email = (signupEmail?.value || '').trim();
      const name = (signupName?.value || '').trim();
      const pw = (signupPassword?.value || '').trim();
      if (!email || !name || !pw) { if (signupError) signupError.textContent = 'Fill name, email and password'; return; }
      if (pw.length < 6) { if (signupError) signupError.textContent = 'Password must be at least 6 characters'; return; }

      signupBtn.disabled = true;
      const res = await signUpWithEmail(email, pw, { full_name: name });
      signupBtn.disabled = false;
      if (res.error) {
        if (signupError) signupError.textContent = res.error.message || 'Signup failed';
        return;
      }

      closeModal();
      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    } catch (err) {
      console.error('signup handler error', err);
      if (signupError) signupError.textContent = 'Unexpected error. See console.';
      try { signupBtn.disabled = false; } catch (_) {}
    }
  });

  if (cancelSignup) cancelSignup.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });
}

/* ---------------- header extras (cart + auth UI) ---------------- */
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
      const userRes = await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 6000))
      ]);
      const user = userRes?.data?.user || userRes?.user || null;
      setUi(!!user);
      if (user) return;
    } catch (e) {
      console.warn('supabase.getUser failed/timeout', e);
    }

    // fallback: token check
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
      if (resp.status === 200) setUi(true);
      else setUi(false);
    } catch (e) {
      console.warn('fallback token check failed', e);
      setUi(false);
    }
  }

  try {
    supabase.auth.onAuthStateChange(() => {
      refreshAuthUI().catch((e) => console.warn('refreshAuthUI error', e));
    });
  } catch (e) { /* ignore */ }

  // initial
  refreshAuthUI().catch((e) => console.warn('initial refreshAuthUI error', e));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      try { e.preventDefault && e.preventDefault(); } catch (_) {}
      try { await supabase.auth.signOut().catch(() => {}); } catch (e) {}
      // clear local tokens (best-effort)
      try { const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token'); localStorage.removeItem(storageKey); } catch(e){}
      try { alert('You have been logged out.'); } catch (e) {}
      window.location.href = '/';
    });
  }
}

/* ---------------- auto-run on DOM ready ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
});

// expose open/close for manual testing
window.openModal = openModal;
window.closeModal = closeModal;
