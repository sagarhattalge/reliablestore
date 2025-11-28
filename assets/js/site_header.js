// assets/js/site_header.js
// Header + Auth modal client script for ReliableStore
// - Uses Supabase client (imported from /assets/js/supabase_client.js)

import { supabase } from '/assets/js/supabase_client.js';

// Edge function endpoint (deployed)
const CHECK_IDENTIFIER_ENDPOINT = (supabase?.supabaseUrl || 'https://gugcnntetqarewwnzrki.supabase.co').replace(/\/$/, '') + '/functions/v1/check-identifier';

// Use anon key from client (safe to be public) for the Edge Function call and fallback checks
const SUPABASE_ANON_KEY = supabase?.supabaseKey || window.SUPABASE_ANON_KEY || '';

window.__rs_block_auto_modal = true; // prevent accidental auto-open

/* ----- small helpers ----- */
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

/* ======= window.RSCart (namespaced cart helpers) ======= */
window.RSCart = window.RSCart || (function(){
  const ns = {};

  ns.readCart = (typeof window.readCart === 'function') ? window.readCart
               : (typeof window.getCart === 'function') ? window.getCart
               : (typeof window.getCartLocal === 'function') ? window.getCartLocal
               : function() {
                   try { return JSON.parse(localStorage.getItem('rs_cart_v1') || '{}'); }
                   catch (e) { console.warn('RSCart.readCart parse error', e); return {}; }
                 };

  ns.writeCart = (typeof window.writeCart === 'function') ? window.writeCart
                : (typeof window.setCart === 'function') ? window.setCart
                : (typeof window.setCartLocal === 'function') ? window.setCartLocal
                : function(cart) {
                    try { localStorage.setItem('rs_cart_v1', JSON.stringify(cart || {})); }
                    catch (e) { console.warn('RSCart.writeCart error', e); }
                    try { window.dispatchEvent(new Event('storage')); } catch(e){}
                  };

  ns.cartTotalCount = function() {
    const c = ns.readCart();
    try { return Object.values(c).reduce((s, i) => s + (i.qty || 0), 0); }
    catch (e) { return 0; }
  };

  ns.setCartCountUi = function(n){
    const el1 = document.getElementById('cart-count');
    const el2 = document.getElementById('cart_count');
    if (el1) el1.innerText = String(n || 0);
    if (el2) el2.innerText = String(n || 0);
  };

  ns.mergeCarts = function(serverCart, localCart) {
    const merged = Object.assign({}, serverCart || {});
    for (const k of Object.keys(localCart || {})) {
      if (!merged[k]) merged[k] = localCart[k];
      else merged[k].qty = (merged[k].qty || 0) + (localCart[k].qty || 0);
    }
    return merged;
  };

  ns.saveCartForUser = async function(userId) {
    if (!userId || typeof supabase === 'undefined') return;
    const items = ns.readCart();
    try {
      const { data, error } = await supabase.from('carts').upsert({ user_id: userId, items }).select();
      if (error) { console.warn('RSCart.saveCartForUser error', error); return { error }; }
      return { data };
    } catch (err) {
      console.warn('RSCart.saveCartForUser exception', err);
      return { error: err };
    }
  };

  ns.loadCartForUser = async function(userId) {
    if (!userId || typeof supabase === 'undefined') return null;
    try {
      const { data, error } = await supabase
        .from('carts')
        .select('items')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) { console.warn('loadCartForUser supabase error', error); return null; }
      return data?.items || null;
    } catch (err) {
      console.warn('RSCart.loadCartForUser exception', err);
      return null;
    }
  };

  return ns;
})();

/* ----- modal accessibility helpers ----- */
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = true; } catch (e) { main.setAttribute('aria-hidden', 'true'); }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = false; } catch (e) { main.removeAttribute('aria-hidden'); }
}

/* ----- open/close modal (Option B: no outside-click close) ----- */
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    console.debug('openModal blocked by guard');
    return;
  }
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
    if (input) try { input.focus(); } catch (e) {}
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
  if (toggle) try { toggle.focus(); } catch (e) {}
}

/* ----- showStep helper - ensures each step's inline display is correct ----- */
function showStep(id) {
  $all('.rs-step').forEach(s => {
    s.classList.add('hidden');
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.style.display = 'block';
  }
}

/* ----- Supabase client helpers ----- */
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

/* ----- Secure existence check (Edge Function) ----- */
async function checkExistingByEmail(identifier) {
  try {
    if (!CHECK_IDENTIFIER_ENDPOINT) {
      console.warn('CHECK_IDENTIFIER_ENDPOINT not configured');
      return null;
    }

    const payload = { identifier: String(identifier || '') };

    const headers = {
      'Content-Type': 'application/json',
    };
    if (SUPABASE_ANON_KEY) {
      headers['apikey'] = SUPABASE_ANON_KEY;
      headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
    }

    const res = await fetch(CHECK_IDENTIFIER_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>');
      console.warn('check-identifier endpoint non-OK', res.status, body);
      return null;
    }

    const json = await res.json().catch(() => null);
    if (!json || typeof json.exists !== 'boolean') {
      console.warn('check-identifier: unexpected response', json);
      return null;
    }
    return json; // { exists: boolean, email?: string }
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}
window.checkExistingByEmail = checkExistingByEmail;

/* ----- wiring modal / events ----- */
function setupAuthModal() {
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const modal = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) return;

  // defensive visual defaults
  modal.style.position = modal.style.position || 'fixed';
  modal.style.inset = modal.style.inset || '0';
  modal.style.display = modal.style.display || 'none';
  modal.style.zIndex = modal.style.zIndex || '1200';
  modal.style.alignItems = modal.style.alignItems || 'center';
  modal.style.justifyContent = modal.style.justifyContent || 'center';

  // elements
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
  const signupAccept    = document.getElementById('rs-signup-accept');
  const signupBtn       = document.getElementById('rs-signup-btn');
  const signupError     = document.getElementById('rs-signup-error');
  const cancelSignup    = document.getElementById('rs-cancel-signup');

  const confText        = document.getElementById('rs-confirmation-text');
  const confClose       = document.getElementById('rs-confirmation-close');
  const confResend      = document.getElementById('rs-confirmation-resend');

  // pick close buttons BUT explicitly exclude the backdrop element (so clicking backdrop won't close)
  const closeBtns = $all('[data-rs-close]').filter(el => !el.classList.contains('rs-modal-backdrop'));

  // open
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    openModal({ force: true });
    showStep('rs-step-enter');
    if (identifierInput) { identifierInput.value = ''; identifierInput.focus(); }
    if (identifierError) identifierError.textContent = '';
  });

  // close via explicit close buttons (not backdrop)
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    closeModal();
  }));

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  // enable/disable signup button based on checkbox
  if (signupAccept && signupBtn) {
    signupAccept.addEventListener('change', () => {
      if (signupAccept.checked) {
        signupBtn.disabled = false;
        signupBtn.style.opacity = '1';
      } else {
        signupBtn.disabled = true;
        signupBtn.style.opacity = '0.7';
      }
    });
  }

  // Identifier -> check existence via Edge Function
  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (identifierError) identifierError.textContent = '';
      const raw = (identifierInput?.value || '').trim();
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

  // helper: wait for SDK to report a user (polling)
  async function waitForSdkUser(timeoutMs = 8000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const r = await supabase.auth.getUser().catch(() => null);
        const u = r?.data?.user || r?.user || null;
        if (u) return u;
      } catch (_) {}
      await new Promise(res => setTimeout(res, intervalMs));
    }
    return null;
  }

  // Sign in (robust: seed SDK and fallback)
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

      // If server returned session, seed SDK
      const session = res.data?.session || null;
      try {
        if (session && session.access_token) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          }).catch(err => console.warn('setSession after signIn returned error', err));
        }
      } catch (err) { console.warn('setSession after sign-in threw', err); }

      // Wait a bit for SDK; if not present, try re-seed from storage
      const user = await waitForSdkUser(8000);
      if (!user) {
        try {
          const storageKey = supabase.storageKey || ('rs_supabase_auth_token_v1');
          const raw = localStorage.getItem(storageKey);
          let parsed = null;
          try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
          const at = parsed?.access_token || parsed?.currentSession?.access_token || null;
          const rt = parsed?.refresh_token || parsed?.currentSession?.refresh_token || null;
          if (at) {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt }).catch(() => {});
            await waitForSdkUser(4000);
          } else {
            console.warn('no stored access token found to re-seed SDK');
          }
        } catch (err) {
          console.warn('re-seed-from-storage failed', err);
        }
      }

      // Close modal and navigate — don't block UX on slow SDK
      try { closeModal(); } catch (e) {}
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
      if (!signupAccept?.checked) { if (signupError) signupError.textContent = 'You must accept the Terms'; return; }

      signupBtn.disabled = true;
      const res = await signUpWithEmail(email, pw, { full_name: name });
      signupBtn.disabled = false;

      if (res.error) {
        if (signupError) signupError.textContent = res.error.message || 'Signup failed';
        return;
      }

      // Success: show confirmation step (do not auto-close)
      const emailSentTo = email;
      if (confText) confText.textContent = `A confirmation link has been sent to ${emailSentTo}. Please follow it to complete your account.`;
      showStep('rs-step-confirmation');
      if (signupPassword) signupPassword.value = '';
      if (signupAccept) { signupAccept.checked = false; signupBtn.disabled = true; signupBtn.style.opacity = '0.7'; }
    } catch (err) {
      console.error('signup handler error', err);
      if (signupError) signupError.textContent = 'Unexpected error. See console.';
      try { signupBtn.disabled = false; } catch (_) {}
    }
  });

  // Resend confirmation (informational placeholder)
  if (confResend) confResend.addEventListener('click', async (e) => {
    try { try { e.preventDefault(); } catch(_){}; if (confText) { const prev = confText.textContent; confText.textContent = 'A new confirmation email request has been triggered (if supported).'; setTimeout(() => { confText.textContent = prev; }, 4000); } } catch (err) { console.error('resend error', err); }
  });

  if (confClose) confClose.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; closeModal(); });
  if (cancelSignup) cancelSignup.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });
}

/* ----- header extras (cart + auth UI) ----- */
export function renderHeaderExtras() {
  // use namespaced cart helpers
  try {
    window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
  } catch (e) {
    console.warn('renderHeaderExtras cart count init failed', e);
  }

  window.addEventListener('storage', () => {
    try { window.RSCart.setCartCountUi(window.RSCart.cartTotalCount()); } catch (e) {}
  });

  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  const toggle = document.getElementById('rs-header-login-toggle');
  const logoutBtn = document.getElementById('rs-logout-btn');

  function setUi(loggedIn) {
    if (toggle) toggle.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
  }

    // Helper to call SDK getSession/getUser with timeouts and graceful fallback
  async function safeGetSessionAndUser() {
    // 1) try getSession quickly
    try {
      const sessRes = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('getSession timeout')), 8000))
      ]);
      const session = sessRes?.data?.session || null;
      const user = session?.user || null;
      if (user) return { session, user };
    } catch (e) {
      console.warn('getSession fast check failed/timeout', e);
    }

    // 2) try getUser with slightly longer timeout
    try {
      const userRes = await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 12000))
      ]);
      const user = userRes?.data?.user || userRes?.user || null;
      if (user) return { session: null, user };
    } catch (e) {
      console.warn('supabase.getUser/getSession failed/timeout', e);
    }

    // 3) fallback: only attempt manual fetch to auth/v1/user if we actually have an access_token stored.
    try {
      const storageKey = supabase.storageKey || ('rs_supabase_auth_token_v1');
      const raw = localStorage.getItem(storageKey);
      let parsed;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
      const access_token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.value?.access_token || null;

      // If there's no access token, do NOT call auth/v1/user (avoids 401 noise).
      if (!access_token) {
        return { session: null, user: null };
      }

      const anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) || supabase?.supabaseKey || '';
      if (!anonKey) {
        return { session: null, user: null };
      }

      const url = (supabase.supabaseUrl || '').replace(/\/$/, '') + '/auth/v1/user';
      const headers = { 'apikey': anonKey, 'Authorization': 'Bearer ' + access_token };

      const resp = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', headers });
      if (resp && resp.status === 200) {
        const j = await resp.json().catch(() => null);
        return { session: null, user: j || null };
      } else {
        return { session: null, user: null };
      }
    } catch (err) {
      console.warn('fallback token check failed', err);
      return { session: null, user: null };
    }
  }

  async function refreshAuthUI() {
    try {
      const { user } = await safeGetSessionAndUser();
      setUi(!!user);
    } catch (e) {
      console.warn('refreshAuthUI error', e);
      setUi(false);
    }
  }

  try {
    supabase.auth.onAuthStateChange(() => {
      refreshAuthUI().catch((e) => console.warn('refreshAuthUI error', e));
    });
  } catch (e) { /* ignore */ }

  refreshAuthUI().catch((e) => console.warn('initial refreshAuthUI error', e));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      try { e.preventDefault && e.preventDefault(); } catch (_) {}
      try { await supabase.auth.signOut().catch(() => {}); } catch (e) {}
      try { const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/^https?:\/\//, '').split('.')[0] + '-auth-token'); localStorage.removeItem(storageKey); } catch(e){}
      try { alert('You have been logged out.'); } catch (e) {}
      window.location.href = '/';
    });
  }
}

/* ----- auto-run on DOM ready ----- */
document.addEventListener('DOMContentLoaded', () => {
  try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
});

// expose open/close for manual testing
window.openModal = openModal;
window.closeModal = closeModal;

/* --------- auth-cart sync wiring (append near end of site_header.js) --------- */

(async function attachCartAuthSync() {
  try {
    // keep the header cart badge updated when local cart changes
    window.addEventListener('storage', () => {
      try { window.RSCart.setCartCountUi(window.RSCart.cartTotalCount()); } catch(e){}
    });

    // On auth state change: when a user signs in, merge their server cart into local cart
    try {
      supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user || (await supabase.auth.getUser()).data?.user || null;
        if (user && user.id) {
          try {
            const server = await window.RSCart.loadCartForUser(user.id);
            const local = window.RSCart.readCart();
            if (server) {
              const merged = window.RSCart.mergeCarts(server, local);
              try { window.RSCart.writeCart(merged); } catch (e) { console.warn(e); }
              window.dispatchEvent(new Event('storage'));
              window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
            } else if (Object.keys(local).length) {
              // persist local cart to server (first-time save)
              await window.RSCart.saveCartForUser(user.id);
            }
          } catch (e) { console.warn('auth-state cart merge failed', e); }
        }
      });
    } catch (e) { /* some older supabase builds may not expose onAuthStateChange; ignore */ }

    // Attach logout click handler that persists or clears cart appropriately
    const logoutBtn = document.getElementById('rs-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (ev) => {
        try { ev && ev.preventDefault(); } catch (e) {}
        // get current user (best-effort)
        let currentUser = null;
        try {
          const ures = await supabase.auth.getUser();
          currentUser = ures?.data?.user || ures?.user || null;
        } catch (e) { /* ignore */ }

        if (currentUser && currentUser.id) {
          // persist cart to server for that user
          try { await window.RSCart.saveCartForUser(currentUser.id); } catch (e) { console.warn(e); }
          // if you want local cart cleared on logout, uncomment next line:
          // try { window.RSCart.writeCart({}); window.dispatchEvent(new Event('storage')); } catch(e){}
        } else {
          // anonymous: clear the local cart so badge becomes zero after logout
          try { window.RSCart.writeCart({}); window.dispatchEvent(new Event('storage')); } catch (e) {}
        }

        try { await supabase.auth.signOut(); } catch (e) {}
        // update UI badge
        try { window.RSCart.setCartCountUi(window.RSCart.cartTotalCount()); } catch(e){}
        // then navigate away or refresh
        window.location.href = '/';
      });
    }
  } catch (err) {
    console.warn('attachCartAuthSync failed', err);
  }
})();
