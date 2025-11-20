// assets/js/site_header.js
// Complete ready-to-copy module for ReliableStore header/modal + Supabase auth integration
// - Accessibility-safe modal (uses inert when available, falls back to aria-hidden on <main>)
// - Guard to prevent accidental auto-open on page load
// - Robust wiring for login / signup / signout and cart count
// - Works as an ES module: import { renderHeaderExtras } in other files if needed
//
// NOTE: this file expects there to be an HTML modal + header markup present in the page,
// e.g. the _includes/header.html you added earlier. It also expects /assets/js/supabase_client.js
// to create and export a `supabase` client. Do NOT paste Supabase keys here.

import { supabase } from '/assets/js/supabase_client.js';

// HARD-PREVENT modal from opening on page load
document.addEventListener("DOMContentLoaded", () => {
  const m = document.getElementById("rs-auth-modal");
  if (m) {
    m.classList.add("hidden");
    m.setAttribute("aria-hidden", "true");
  }
});

window.__rs_block_auto_modal = true; // block auto-open unless explicitly forced

/* -------------------- small helpers -------------------- */
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

/* -------------------- modal accessibility helpers -------------------- */
/*
  Use `inert` on the main content to hide background from assistive tech.
  Fallback: set aria-hidden on <main> or <body>.
*/
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try {
    // prefer native inert
    main.inert = true;
  } catch (e) {
    main.setAttribute('aria-hidden', 'true');
  }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try {
    main.inert = false;
  } catch (e) {
    main.removeAttribute('aria-hidden');
  }
}

/* -------------------- modal open/close -------------------- */
/*
  openModal({ force: true }) -> always opens
  openModal()            -> opens only if window.__rs_block_auto_modal !== true
*/
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    console.debug('rs-auth-modal open blocked by __rs_block_auto_modal');
    return;
  }
  const m = $('#rs-auth-modal');
  if (!m) return;
  // show modal
  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');
  // inert the rest of the page
  _disablePageForModal();
  // focus first focusable element inside modal
  setTimeout(() => {
    const input = m.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (input) {
      try { input.focus(); } catch (e) {}
    }
  }, 80);
}
function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  _restorePageAfterModal();
  // return focus to toggle if present
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  if (toggle) try { toggle.focus(); } catch (e) {}
}
function showStep(id) {
  $all('.rs-step').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

/* -------------------- Supabase helpers -------------------- */
async function checkExistingByEmail(email) {
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) {
      console.warn('customers table check error:', error);
      return null;
    }
    return data ? true : false;
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}
async function signInWithPassword(email, password) {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  } catch (e) {
    return { error: e };
  }
}
async function signUpWithEmail(email, password, metadata = {}) {
  try {
    const res = await supabase.auth.signUp({ email, password, options: { data: metadata }});
    return res;
  } catch (e) {
    return { error: e };
  }
}

/* -------------------- modal wiring -------------------- */
function setupAuthModal() {
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const modal = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) {
    // nothing to wire
    return;
  }

  const identifierInput = document.getElementById('rs-identifier');
  const identifierNext = document.getElementById('rs-identifier-next');
  const identifierError = document.getElementById('rs-identifier-error');

  const knownEmailText = document.getElementById('rs-known-email');
  const passwordInput = document.getElementById('rs-password');
  const signinBtn = document.getElementById('rs-signin-btn');
  const passwordError = document.getElementById('rs-password-error');
  const backToEnter = document.getElementById('rs-back-to-enter');

  const signupEmail = document.getElementById('rs-signup-email');
  const signupName = document.getElementById('rs-signup-name');
  const signupPassword = document.getElementById('rs-signup-password');
  const signupBtn = document.getElementById('rs-signup-btn');
  const signupError = document.getElementById('rs-signup-error');
  const cancelSignup = document.getElementById('rs-cancel-signup');

  const closeBtns = $all('[data-rs-close]');

  // Open modal when user clicks (force bypass guard)
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    openModal({ force: true });
    showStep('rs-step-enter');
    if (identifierInput) identifierInput.value = '';
    if (identifierError) identifierError.textContent = '';
    setTimeout(() => identifierInput && identifierInput.focus(), 120);
  });

  // close via backdrop and close buttons
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    closeModal();
  }));

  // close when clicking outside panel
  document.addEventListener('click', (ev) => {
    try {
      const m = document.getElementById('rs-auth-modal');
      if (!m || m.classList.contains('hidden')) return;
      const panel = m.querySelector('.rs-modal-panel');
      if (!panel) return;
      if (!panel.contains(ev.target)) closeModal();
    } catch (e) {}
  });

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Back to step enter
  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  // Identifier -> determine existing/new
  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (identifierError) identifierError.textContent = '';
      const raw = (identifierInput?.value || '').trim();
      if (!raw) { if (identifierError) identifierError.textContent = 'Please enter your email or mobile number'; return; }

      // Phone branch (digits-only lookups)
      if (/^\d{10,}$/.test(raw)) {
        try {
          const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
          if (error) { console.warn('phone lookup error', error); if (identifierError) identifierError.textContent = 'Could not check phone right now'; return; }
          if (data && data.email) {
            knownEmailText.textContent = data.email;
            showStep('rs-step-password');
            passwordInput && (passwordInput.value = '');
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
          console.warn('phone check exception', err);
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
        knownEmailText.textContent = email;
        showStep('rs-step-password');
        passwordInput && (passwordInput.value = '');
        if (passwordError) passwordError.textContent = '';
      } else if (exists === false) {
        if (signupEmail) signupEmail.value = email;
        if (signupName) signupName.value = '';
        if (signupPassword) signupPassword.value = '';
        showStep('rs-step-signup');
        signupPassword && signupPassword.focus();
      } else {
        // unknown fallback -> prompt password
        knownEmailText.textContent = email;
        showStep('rs-step-password');
        passwordInput && (passwordInput.value = '');
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
        console.warn('signIn error', res.error);
        if (passwordError) passwordError.textContent = res.error.message || 'Sign in failed';
        return;
      }

      // set session explicitly if returned
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
        console.warn('signup error', res.error);
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

/* -------------------- header extras (cart + auth UI) -------------------- */
export function renderHeaderExtras() {
  // cart count
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  // modal wiring
  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  // UI updates for logged-in state: hide login toggle, show logout button
  try {
    const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
    const logoutBtn = document.getElementById('rs-logout-btn') || document.getElementById('btn_logout');

    function setUiLoggedIn(loggedIn) {
      if (toggle) toggle.style.display = loggedIn ? 'none' : '';
      if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
    }

    async function refreshAuthUI() {
      // try Supabase getUser with a timeout
      try {
        const userRes = await Promise.race([
          supabase.auth.getUser(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 6000))
        ]);
        const user = userRes && userRes.data && userRes.data.user ? userRes.data.user : (userRes && userRes.user ? userRes.user : null);
        if (user) {
          setUiLoggedIn(true);
          return;
        }
      } catch (e) {
        console.warn('supabase.getUser failed/timeout, falling back to token check', e);
      }

      // fallback: check stored token and hit /auth/v1/user
      try {
        const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token');
        const raw = localStorage.getItem(storageKey);
        if (!raw) { setUiLoggedIn(false); return; }
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        const access_token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.value?.access_token;
        if (!access_token) { setUiLoggedIn(false); return; }
        const url = (supabase.supabaseUrl || '').replace(/\/$/, '') + '/auth/v1/user';
        const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': 'Bearer ' + access_token, 'apikey': supabase.supabaseKey }, mode: 'cors', cache: 'no-store' });
        if (resp.status === 200) setUiLoggedIn(true);
        else setUiLoggedIn(false);
      } catch (e) {
        console.warn('fallback token check failed', e);
        setUiLoggedIn(false);
      }
    }

    // wire auth state change
    try {
      supabase.auth.onAuthStateChange(() => {
        refreshAuthUI().catch((e) => console.warn('refreshAuthUI error', e));
      });
    } catch (e) { /* ignore */ }

    // initial
    refreshAuthUI().catch((e) => console.warn('initial refreshAuthUI error', e));

    // logout button handler
    if (document.getElementById('rs-logout-btn') || document.getElementById('btn_logout')) {
      const lb = document.getElementById('rs-logout-btn') || document.getElementById('btn_logout');
      lb.addEventListener('click', async (e) => {
        try { e.preventDefault && e.preventDefault(); } catch (_) {}
        try { await supabase.auth.signOut().catch(() => {}); } catch (e) {}
        // clear auth tokens we may have used
        try {
          const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token');
          localStorage.removeItem(storageKey);
          Object.keys(localStorage).forEach(k => { if (/supabase|sb-|auth|session|token/.test(k)) localStorage.removeItem(k); });
        } catch (e) {}
        try { alert('You have been logged out.'); } catch (e) {}
        window.location.href = '/';
      });
    }

  } catch (e) {
    console.warn('auth state wiring failed', e);
  }
}

/* -------------------- auto-run on import -------------------- */
try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
