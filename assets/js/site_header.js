import { supabase } from '/assets/js/supabase_client.js';

window.__rs_block_auto_modal = true;

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

function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = true; } catch (e) { main.setAttribute('aria-hidden', 'true'); }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = false; } catch (e) { main.removeAttribute('aria-hidden'); }
}

function openModal(opts = {}) {
  const force = !!opts.force;
  console.log("openModal called", { force, blockFlag: window.__rs_block_auto_modal });
  const m = $('#rs-auth-modal');
  console.log("Modal element:", m);

  if (!m) return;

  // Force show
  m.style.display = "flex";
  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');

  _disablePageForModal();

  setTimeout(() => {
    const input = m.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    if (input) {
      try { input.focus(); } catch (_) {}
    }
  }, 80);
}

function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.style.display = "none";
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  _restorePageAfterModal();
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  if (toggle) try { toggle.focus(); } catch (_) {}
}

function showStep(id) {
  $all('.rs-step').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

async function checkExistingByEmail(email) {
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) { console.warn('checkExistingByEmail error', error); return null; }
    return data ? true : false;
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}
async function signInWithPassword(email, password) {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    console.log("signInWithPassword result:", res);
    return res;
  } catch (e) {
    console.error("signInWithPassword exception", e);
    return { error: e };
  }
}
async function signUpWithEmail(email, password, metadata = {}) {
  try {
    const res = await supabase.auth.signUp({ email, password, options: { data: metadata }});
    console.log("signUpWithEmail result:", res);
    return res;
  } catch (e) {
    console.error("signUpWithEmail exception", e);
    return { error: e };
  }
}

function setupAuthModal() {
  console.log("setupAuthModal running");
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const modal = document.getElementById('rs-auth-modal');
  console.log("toggle:", toggle, "modal:", modal);
  if (!toggle || !modal) { console.warn("Toggle or modal not found."); return; }

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

  toggle.addEventListener('click', (e) => {
    console.log("Login / Sign Up button clicked");
    e.preventDefault();
    openModal({ force: true });
    showStep('rs-step-enter');
    if (identifierInput) identifierInput.value = '';
    if (identifierError) identifierError.textContent = '';
    setTimeout(() => identifierInput?.focus(), 120);
  });

  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    console.log("Close button clicked");
    e.preventDefault();
    closeModal();
  }));

  document.addEventListener('click', (ev) => {
    const m = document.getElementById('rs-auth-modal');
    if (!m || m.classList.contains('hidden')) return;
    const panel = m.querySelector('.rs-modal-panel');
    if (!panel) return;
    if (!panel.contains(ev.target)) {
      console.log("Clicked outside panel – closing modal");
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      console.log("Escape pressed – closing modal");
      closeModal();
    }
  });

  if (backToEnter) backToEnter.addEventListener('click', (e) => {
    e.preventDefault();
    showStep('rs-step-enter');
  });

  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    e.preventDefault();
    identifierError.textContent = '';
    const raw = (identifierInput?.value || '').trim();
    if (!raw) {
      identifierError.textContent = 'Please enter your email or mobile number';
      return;
    }

    if (/^\d{10,}$/.test(raw)) {
      // phone logic
      try {
        const { data } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
        if (data?.email) {
          knownEmailText.textContent = data.email;
          showStep('rs-step-password');
          passwordInput.value = '';
        } else {
          signupEmail.value = '';
          signupName.value = '';
          signupPassword.value = '';
          showStep('rs-step-signup');
          signupEmail.focus();
        }
      } catch (err) {
        identifierError.textContent = 'Unable to check right now';
      }
      return;
    }

    // email branch
    const email = raw;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      identifierError.textContent = 'Please enter a valid email address';
      return;
    }

    identifierNext.disabled = true;
    const exists = await checkExistingByEmail(email);
    identifierNext.disabled = false;

    if (exists === true) {
      knownEmailText.textContent = email;
      showStep('rs-step-password');
      passwordInput.value = '';
      if (passwordError) passwordError.textContent = '';
    } else if (exists === false) {
      signupEmail.value = email;
      signupName.value = '';
      signupPassword.value = '';
      showStep('rs-step-signup');
      signupPassword.focus();
    } else {
      knownEmailText.textContent = email;
      showStep('rs-step-password');
      passwordInput.value = '';
    }
  });

  if (signinBtn) signinBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    passwordError.textContent = '';
    const email = (knownEmailText?.textContent || '').trim();
    const pw = (passwordInput?.value || '').trim();
    if (!email || !pw) {
      if (passwordError) passwordError.textContent = 'Enter your password';
      return;
    }

    signinBtn.disabled = true;
    const res = await signInWithPassword(email, pw);
    signinBtn.disabled = false;

    if (res.error) {
      console.warn('signIn error', res.error);
      if (passwordError) passwordError.textContent = res.error.message || 'Sign in failed';
      return;
    }

    try {
      if (res.data?.session) {
        await supabase.auth.setSession({
          access_token: res.data.session.access_token,
          refresh_token: res.data.session.refresh_token,
        });
      }
    } catch (e) {
      console.warn('setSession after sign-in failed', e);
    }

    closeModal();
    const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
    window.location.href = decodeURIComponent(rt || '/');
  });

  if (signupBtn) signupBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    const email = (signupEmail?.value || '').trim();
    const name = (signupName?.value || '').trim();
    const pw = (signupPassword?.value || '').trim();
    if (!email || !name || !pw) {
      signupError.textContent = 'Fill name, email and password';
      return;
    }
    if (pw.length < 6) {
      signupError.textContent = 'Password must be at least 6 characters';
      return;
    }

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
  });

  if (cancelSignup) cancelSignup.addEventListener('click', (e) => {
    e.preventDefault();
    showStep('rs-step-enter');
  });
}

export function renderHeaderExtras() {
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const logoutBtn = document.getElementById('rs-logout-btn') || document.getElementById('btn_logout');

  function setUiLoggedIn(loggedIn) {
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
      setUiLoggedIn(!!user);
      if (user) return;
    } catch (e) {
      console.warn('supabase.getUser failed', e);
    }

    // fallback token check
    try {
      const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token');
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setUiLoggedIn(false); return; }
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
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

  try {
    supabase.auth.onAuthStateChange(() => {
      refreshAuthUI().catch((e) => console.warn('refreshAuthUI error', e));
    });
  } catch (e) { console.warn('onAuthStateChange error', e); }

  refreshAuthUI().catch((e) => console.warn('initial refreshAuthUI error', e));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault && e.preventDefault();
      await supabase.auth.signOut().catch(() => {});
      const storageKey = supabase.storageKey || ('sb-' + (supabase.supabaseUrl || '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token');
      localStorage.removeItem(storageKey);
      Object.keys(localStorage).forEach(k => {
        if (/supabase|sb-|auth|session|token/.test(k)) localStorage.removeItem(k);
      });
      alert('You have been logged out.');
      window.location.href = '/';
    });
  }
}

try { renderHeaderExtras(); } catch (e) { console.warn('renderHeaderExtras error', e); }
