// assets/js/site_header.js
// Header + Auth modal + safe cart merge for ReliableStore
// - Expects /assets/js/supabase_client.js to export `supabase`
// - Implements idempotent merge (session-scoped) to avoid repeated merges

import { supabase } from '/assets/js/supabase_client.js';

// Edge function endpoint (optional)
const CHECK_IDENTIFIER_ENDPOINT = (supabase?.supabaseUrl || 'https://gugcnntetqarewwnzrki.supabase.co').replace(/\/$/, '') + '/functions/v1/check-identifier';
const SUPABASE_ANON_KEY = supabase?.supabaseKey || '';

window.__rs_block_auto_modal = true; // prevents accidental auto-open

/* small helpers */
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

/* ===== window.RSCart (namespaced cart helpers) ===== */
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

  // Merge policy (user wants sum of quantities)
  ns.mergeCarts = function(serverCart, localCart) {
    // both serverCart and localCart are objects keyed by product id
    const merged = Object.assign({}, serverCart || {});
    for (const k of Object.keys(localCart || {})) {
      const localItem = localCart[k] || {};
      if (!merged[k]) merged[k] = Object.assign({}, localItem);
      else {
        // sum quantities (ensure numeric)
        const sQty = Number(merged[k].qty || 0);
        const lQty = Number(localItem.qty || 0);
        merged[k].qty = sQty + lQty;
      }
    }
    return merged;
  };

  // Persist cart to server (upsert row: user_id, items)
  ns.saveCartForUser = async function(userId) {
    if (!userId || typeof supabase === 'undefined') return;
    const items = ns.readCart();
    try {
      const { data, error } = await supabase.from('carts').upsert({ user_id: userId, items }).select();
      if (error) {
        console.warn('RSCart.saveCartForUser error', error);
        return { error };
      }
      return { data };
    } catch (err) {
      console.warn('RSCart.saveCartForUser exception', err);
      return { error: err };
    }
  };

  ns.loadCartForUser = async function(userId) {
    if (!userId || typeof supabase === 'undefined') return null;
    try {
      const { data, error } = await supabase.from('carts').select('items').eq('user_id', userId).maybeSingle();
      if (error) { console.warn('loadCartForUser supabase error', error); return null; }
      return data?.items || null;
    } catch (err) {
      console.warn('RSCart.loadCartForUser exception', err);
      return null;
    }
  };

  return ns;
})();

/* modal accessibility helpers */
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = true; } catch (e) { main.setAttribute('aria-hidden', 'true'); }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = false; } catch (e) { main.removeAttribute('aria-hidden'); }
}

/* open/close modal (no outside-click close) */
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) return;
  const m = $('#rs-auth-modal'); if (!m) return;
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
  const m = $('#rs-auth-modal'); if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  m.style.display = 'none';
  _restorePageAfterModal();
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  if (toggle) try { toggle.focus(); } catch (e) {}
}

/* step UI */
function showStep(id) {
  $all('.rs-step').forEach(s => { s.classList.add('hidden'); s.style.display = 'none'; });
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
}

/* Supabase helpers */
async function signInWithPassword(email, password) {
  try { return await supabase.auth.signInWithPassword({ email, password }); }
  catch (e) { return { error: e }; }
}
async function signUpWithEmail(email, password, metadata = {}) {
  try { return await supabase.auth.signUp({ email, password, options: { data: metadata }}); }
  catch (e) { return { error: e }; }
}

/* Edge function checkExistingByEmail */
async function checkExistingByEmail(identifier) {
  try {
    if (!CHECK_IDENTIFIER_ENDPOINT) { console.warn('CHECK_IDENTIFIER_ENDPOINT not configured'); return null; }
    const payload = { identifier: String(identifier || '') };
    const headers = { 'Content-Type': 'application/json' };
    if (SUPABASE_ANON_KEY) { headers['apikey'] = SUPABASE_ANON_KEY; headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY; }
    const res = await fetch(CHECK_IDENTIFIER_ENDPOINT, { method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit', headers, body: JSON.stringify(payload) });
    if (!res.ok) { const body = await res.text().catch(() => '<no body>'); console.warn('check-identifier endpoint non-OK', res.status, body); return null; }
    const json = await res.json().catch(() => null);
    if (!json || typeof json.exists !== 'boolean') { console.warn('check-identifier: unexpected response', json); return null; }
    return json;
  } catch (err) { console.warn('checkExistingByEmail exception', err); return null; }
}
window.checkExistingByEmail = checkExistingByEmail;

/* ----- modal wiring ----- */
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

  const closeBtns = $all('[data-rs-close]').filter(el => !el.classList.contains('rs-modal-backdrop'));

  // open
  toggle.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; openModal({ force: true }); showStep('rs-step-enter'); if (identifierInput) { identifierInput.value = ''; identifierInput.focus(); } if (identifierError) identifierError.textContent = ''; });

  // close via explicit close buttons
  closeBtns.forEach(b => b.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; closeModal(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  if (signupAccept && signupBtn) signupAccept.addEventListener('change', () => {
    if (signupAccept.checked) { signupBtn.disabled = false; signupBtn.style.opacity = '1'; }
    else { signupBtn.disabled = true; signupBtn.style.opacity = '0.7'; }
  });

  // identifier next (phone/email check)
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
        if (res.exists && res.email) { if (knownEmailText) knownEmailText.textContent = res.email; if (passwordInput) passwordInput.value = ''; showStep('rs-step-password'); return; }
        else if (res.exists) { showStep('rs-step-password'); return; }
        else { if (signupEmail) signupEmail.value = ''; if (signupName) signupName.value = ''; if (signupPassword) signupPassword.value = ''; showStep('rs-step-signup'); signupEmail && signupEmail.focus(); return; }
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

  /* ---------- SIGN IN: carefully seed SDK + run single merge ---------- */
  if (signinBtn) signinBtn.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch (_) {}
      if (passwordError) passwordError.textContent = '';
      const email = (knownEmailText?.textContent || '').trim();
      const pw = (passwordInput?.value || '').trim();
      if (!email || !pw) { if (passwordError) passwordError.textContent = 'Enter your password'; return; }

      signinBtn.disabled = true;

      // 1) call sign-in
      const res = await signInWithPassword(email, pw);

      if (res.error) {
        signinBtn.disabled = false;
        if (passwordError) passwordError.textContent = res.error.message || 'Sign in failed';
        return;
      }

      // 2) If sign-in gave a session, seed the SDK so getUser/getSession work immediately
      try {
        const sess = res.data?.session || null;
        if (sess && sess.access_token) {
          await supabase.auth.setSession({
            access_token: sess.access_token,
            refresh_token: sess.refresh_token
          }).catch(err => {
            console.warn('setSession after sign-in failed (non-fatal):', err);
          });
        }
      } catch (e) { console.warn('seeding session after sign-in threw', e); }

      // 3) prevent duplicate immediate auth handler run
      window.__RS_ignore_next_auth_event = true;
      setTimeout(() => { window.__RS_ignore_next_auth_event = false; }, 1000);

      // 4) wait briefly for SDK to stabilise and get user
      let userObj = null;
      for (let i=0;i<10;i++) {
        const ures = await supabase.auth.getUser().catch(()=>({ error: true }));
        userObj = ures?.data?.user || ures?.user || null;
        if (userObj && userObj.id) break;
        await new Promise(r=>setTimeout(r, 150));
      }

      // 5) perform cart merge once for this session (guarded)
      try {
        if (userObj && userObj.id) {
          await performCartMergeOnce(userObj.id);
        }
      } catch(e) { console.warn('performCartMergeOnce failed', e); }

      // 6) close modal and go to returnTo
      try { closeModal(); } catch(e){ console.warn('closeModal fail', e); }

      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');

    } catch (err) {
      console.error('signin handler error', err);
      if (passwordError) passwordError.textContent = 'Unexpected error. See console.';
      try { signinBtn.disabled = false; } catch (_) {}
    }
  });

  /* ---------- SIGN UP ---------- */
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

  if (confResend) confResend.addEventListener('click', async (e) => { try { e.preventDefault(); } catch(_){}; if (confText) { const prev = confText.textContent; confText.textContent = 'A new confirmation email request has been triggered (if supported).'; setTimeout(() => { confText.textContent = prev; }, 4000); } });

  if (confClose) confClose.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; closeModal(); });
  if (cancelSignup) cancelSignup.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });
}

/* ---------- header extras (cart + auth UI) ---------- */
export function renderHeaderExtras() {
  try { window.RSCart.setCartCountUi(window.RSCart.cartTotalCount()); } catch (e) { console.warn('renderHeaderExtras cart count init failed', e); }
  window.addEventListener('storage', () => { try { window.RSCart.setCartCountUi(window.RSCart.cartTotalCount()); } catch (e) {} });

  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  const toggle = document.getElementById('rs-header-login-toggle');
  const logoutBtn = document.getElementById('rs-logout-btn');

  function setUi(loggedIn) {
    if (toggle) toggle.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
  }

  /* safe session+user getter with timeouts (non-throwing) */
  async function safeGetSessionAndUser() {
    // Try SDK getSession then getUser with guarded timeout
    try {
      const sessRes = await Promise.race([ supabase.auth.getSession(), new Promise((_, rej) => setTimeout(() => rej(new Error('getSession timeout')), 8000)) ]);
      const session = sessRes?.data?.session || null;
      const user = session?.user || null;
      if (user) return { session, user };
    } catch (e) {}
    try {
      const userRes = await Promise.race([ supabase.auth.getUser(), new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 12000)) ]);
      const user = userRes?.data?.user || userRes?.user || null;
      return { session: null, user };
    } catch (e) {}
    return { session: null, user: null };
  }

  async function refreshAuthUI() {
    try {
      const { user } = await safeGetSessionAndUser();
      setUi(!!user);
      // If logged in, ensure cart merge happens once (sessionStorage guard)
      if (user && user.id) {
        try { await performCartMergeOnce(user.id); } catch (e) { console.warn('performCartMergeOnce failed in refreshAuthUI', e); }
      }
      return;
    } catch (e) {
      console.warn('refreshAuthUI unexpected error', e);
      setUi(false);
    }
  }

  /* onAuthStateChange: ignore immediate one if flagged */
  try {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (window.__RS_ignore_next_auth_event) {
        window.__RS_ignore_next_auth_event = false;
        return;
      }
      // Debounce / guard multiple quick events
      if (window.__RS_auth_event_debounce) return;
      window.__RS_auth_event_debounce = true;
      setTimeout(() => { window.__RS_auth_event_debounce = false; }, 700);

      const user = session?.user || (await supabase.auth.getUser()).data?.user || null;
      try {
        // run one-time cart merge when user signs in
        if (user && user.id) {
          await performCartMergeOnce(user.id);
        }
      } catch (e) { console.warn('onAuthStateChange merge failed', e); }

      // update UI
      try { await refreshAuthUI(); } catch (e) { console.warn('refreshAuthUI on auth event failed', e); }
    });
  } catch (e) { /* ignore older SDK */ }

  // initial run
  refreshAuthUI().catch((e) => console.warn('initial refreshAuthUI error', e));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      try { e && e.preventDefault(); } catch (_) {}
      // persist local cart to server if user exists (best-effort)
      let currentUser = null;
      try {
        const ures = await supabase.auth.getUser();
        currentUser = ures?.data?.user || ures?.user || null;
      } catch (e) { /* ignore */ }

      if (currentUser && currentUser.id) {
        try { await window.RSCart.saveCartForUser(currentUser.id); } catch (e) { console.warn(e); }
      } else {
        try { window.RSCart.writeCart({}); window.dispatchEvent(new Event('storage')); } catch (e) {}
      }

      try { await supabase.auth.signOut(); } catch (e) {}
      // cleanup merge flag for safety
      try { sessionStorage.removeItem('rs_cart_merged_' + (currentUser?.id || '')); } catch(e){}
      try { window.RSCart.setCartCountUi(window.RSCart.cartTotalCount()); } catch(e){}
      window.location.href = '/';
    });
  }
}

/* ---------- performCartMergeOnce(userId) ----------
   Ensures merge runs at most once per page session for a given user.
   Uses sessionStorage key 'rs_cart_merged_<userId>' to remember.
*/
async function performCartMergeOnce(userId) {
  if (!userId) return;
  const key = 'rs_cart_merged_' + userId;
  try {
    if (sessionStorage.getItem(key)) {
      // already merged this session, ensure UI uses merged cart
      const server = await window.RSCart.loadCartForUser(userId);
      if (server) {
        window.RSCart.writeCart(server);
        window.dispatchEvent(new Event('storage'));
        window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
      }
      return;
    }

    // set guard now to avoid races
    sessionStorage.setItem(key, 'in-progress');

    // read server and local
    const [server, local] = await Promise.all([
      window.RSCart.loadCartForUser(userId).catch(e => { console.warn('loadCartForUser failed', e); return null; }),
      (async () => window.RSCart.readCart())()
    ]);

    // if both empty => nothing to do
    const serverEmpty = !server || Object.keys(server).length === 0;
    const localEmpty = !local || Object.keys(local).length === 0;

    if (serverEmpty && localEmpty) {
      sessionStorage.setItem(key, 'done');
      return;
    }

    // Build merged result: sum quantities
    const merged = window.RSCart.mergeCarts(server || {}, local || {});

    // Safety: If merged equals server (no change), just write server to local to sync UI
    const serverJson = JSON.stringify(server || {});
    const mergedJson = JSON.stringify(merged || {});
    if (serverJson === mergedJson) {
      // nothing changed; copy server to local
      window.RSCart.writeCart(server || {});
      window.dispatchEvent(new Event('storage'));
      window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
      sessionStorage.setItem(key, 'done');
      return;
    }

    // Save merged to server (upsert)
    try {
      const { data, error } = await supabase.from('carts').upsert({ user_id: userId, items: merged }).select();
      if (error) {
        console.warn('performCartMergeOnce: upsert error', error);
        // still write merged locally so UI sees expected result
        window.RSCart.writeCart(merged);
        window.dispatchEvent(new Event('storage'));
        window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
        sessionStorage.setItem(key, 'done-with-error');
        return;
      }
      // success: write server's stored items back to local (data[0]?.items)
      const savedItems = (data && data[0] && data[0].items) ? data[0].items : merged;
      window.RSCart.writeCart(savedItems);
      window.dispatchEvent(new Event('storage'));
      window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
      sessionStorage.setItem(key, 'done');
    } catch (err) {
      console.warn('performCartMergeOnce: exception saving merged cart', err);
      // fallback: write merged local copy so UI consistent
      window.RSCart.writeCart(merged);
      window.dispatchEvent(new Event('storage'));
      window.RSCart.setCartCountUi(window.RSCart.cartTotalCount());
      sessionStorage.setItem(key, 'done-with-exception');
    }
  } catch (e) {
    console.warn('performCartMergeOnce generic error', e);
    try { sessionStorage.setItem(key, 'failed'); } catch(_) {}
  }
}

/* auto-run on DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
});

// Expose some helpers to the console for debugging
window.performCartMergeNow = async function() {
  try {
    const ures = await supabase.auth.getUser().catch(()=>({ error:true }));
    const user = ures?.data?.user || ures?.user || null;
    if (!user || !user.id) throw new Error('no signed-in user');
    await performCartMergeOnce(user.id);
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
};

window.openModal = openModal;
window.closeModal = closeModal;

