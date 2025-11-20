import { supabase } from '/assets/js/supabase_client.js';

// Prevent accidental auto-open on page load
window.__rs_block_auto_modal = true;

// helpers
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

/* ---------------- cart helpers ---------------- */
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
/*
 openModal({force:true}) -> force open despite guard
 openModal() -> opens only if guard allows
*/
let ignoreDocumentClick = false;

function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    // blocked by guard
    return;
  }

  const m = $('#rs-auth-modal');
  if (!m) return;

  // Ensure visual layout
  m.style.display = 'flex';
  m.style.alignItems = 'center';
  m.style.justifyContent = 'center';

  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');

  _disablePageForModal();

  // Ignore the immediate document click after open (prevents race close)
  ignoreDocumentClick = true;
  setTimeout(() => { ignoreDocumentClick = false; }, 160);

  // focus first input (small delay to ensure visible)
  setTimeout(() => {
    const input = m.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (input) {
      try { input.focus(); } catch (e) {}
    }
  }, 90);
}

function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;

  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');

  // hide visually
  m.style.display = 'none';

  _restorePageAfterModal();

  const toggle = document.getElementById('rs-header-login-toggle');
  if (toggle) try { toggle.focus(); } catch (e) {}
}

/* ---------------- modal step helper ---------------- */
function showStep(id) {
  $all('.rs-step').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

/* ---------------- Supabase helpers ---------------- */
async function checkExistingByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id,email')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('customers table check error', error);
      return null;
    }
    return !!data;
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}

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

/* ---------------- modal wiring ---------------- */
function setupAuthModal() {
  const toggle = document.getElementById('rs-header-login-toggle');
  const modal  = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) return;

  // Defensive visual state
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'none';
  modal.style.zIndex = '1200';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  // Elements
  const identifierInput = $('#rs-identifier');
  const identifierNext  = $('#rs-identifier-next');
  const identifierError = $('#rs-identifier-error');

  const knownEmailText  = $('#rs-known-email');
  const passwordInput   = $('#rs-password');
  const signinBtn       = $('#rs-signin-btn');
  const passwordError   = $('#rs-password-error');

  const backToEnter     = $('#rs-back-to-enter');

  const signupEmail     = $('#rs-signup-email');
  const signupName      = $('#rs-signup-name');
  const signupPassword  = $('#rs-signup-password');
  const signupBtn       = $('#rs-signup-btn');
  const signupError     = $('#rs-signup-error');
  const cancelSignup    = $('#rs-cancel-signup');

  const closeBtns       = $all('[data-rs-close]');

  // Open modal on toggle click
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
    openModal({ force: true });
    showStep('rs-step-enter');
    if (identifierInput) { identifierInput.value = ''; identifierInput.focus(); }
    if (identifierError) identifierError.textContent = '';
  });

  // close via close buttons/backdrop
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    closeModal();
  }));

  // document-level outside click (mouse down)
  document.addEventListener('mousedown', (ev) => {
    if (ignoreDocumentClick) return;
    const m = $('#rs-auth-modal');
    if (!m || m.classList.contains('hidden')) return;
    const panel = m.querySelector('.rs-modal-panel');
    if (!panel) return;
    if (!panel.contains(ev.target)) closeModal();
  });

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Back button
  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  // Identifier next
  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (identifierError) identifierError.textContent = '';
      const raw = (identifierInput?.value || '').trim();
      if (!raw) { if (identifierError) identifierError.textContent = 'Please enter your email or mobile number'; return; }

      // Phone branch
      if (/^\d{10,}$/.test(raw)) {
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('id,email,phone')
            .eq('phone', raw)
            .limit(1)
            .maybeSingle();
          if (error) { if (identifierError) identifierError.textContent = 'Could not check phone right now'; return; }
          if (data && data.email) {
            if (knownEmailText) knownEmailText.textContent = data.email;
            if (passwordInput) passwordInput.value = '';
            showStep('rs-step-password');
            return;
          } else {
            if (signupEmail) signupEmail.value = '';
            if (signupName) signupName.value = '';
            if (signupPassword) signupPassword.value = '';
            showStep('rs-step-signup');
            signupEmail && signupEmail.focus();
            return;
          }
        } catch (err) {
          if (identifierError) identifierError.textContent = 'Unable to check right now';
          return;
        }
      }

      // Email branch
      const email = raw;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (identifierError) identifierError.textContent = 'Please enter a valid email address'; return; }

      identifierNext.disabled = true;
      const exists = await checkExistingByEmail(email);
      identifierNext.disabled = false;

      if (exists === true) {
        if (knownEmailText) knownEmailText.textContent = email;
        passwordInput && (passwordInput.value = '');
        showStep('rs-step-password');
        if (passwordError) passwordError.textContent = '';
      } else if (exists === false) {
        if (signupEmail) signupEmail.value = email;
        if (signupName) signupName.value = '';
        if (signupPassword) signupPassword.value = '';
        showStep('rs-step-signup');
        signupPassword && signupPassword.focus();
      } else {
        // unknown -> ask password (fallback)
        if (knownEmailText) knownEmailText.textContent = email;
        passwordInput && (passwordInput.value = '');
        showStep('rs-step-password');
      }
    } catch (err) {
      if (identifierError) identifierError.textContent = 'Unexpected error. Check console.';
      console.error('identifierNext handler error', err);
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

      // if session data returned, optionally set it (safe)
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
      if (passwordError) passwordError.textContent = 'Unexpected error. See console.';
      console.error('signin handler error', err);
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
      if (signupError) signupError.textContent = 'Unexpected error. See console.';
      console.error('signup handler error', err);
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
      try { const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token'); localStorage.removeItem(storageKey); } catch(e){}
      alert('You have been logged out.');
      window.location.href = '/';
    });
  }
}

/* ---------------- auto-run on DOM ready ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
});
