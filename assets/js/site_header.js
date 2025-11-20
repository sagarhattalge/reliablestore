import { supabase } from '/assets/js/supabase_client.js';

// prevent any auto-open by old Shopify/legacy logic
window.__rs_block_auto_modal = true;

// short helpers
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

// ---------------------- Cart Helpers ----------------------
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

// ---------------------- Modal Helpers ----------------------
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = true; } catch (e) { main.setAttribute('aria-hidden', 'true'); }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try { main.inert = false; } catch (e) { main.removeAttribute('aria-hidden'); }
}

function openModal(opts = {}) {
  console.log("openModal called", opts);
  const m = $('#rs-auth-modal');
  if (!m) return;

  // Force proper modal display
  m.style.display = "flex";          // CENTER FIX
  m.style.alignItems = "center";     // CENTER FIX
  m.style.justifyContent = "center"; // CENTER FIX

  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');

  _disablePageForModal();

  // focus first input
  setTimeout(() => {
    const input = m.querySelector('input');
    if (input) try { input.focus(); } catch(_) {}
  }, 80);
}

function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;

  m.style.display = "none";
  m.classList.add('hidden');
  m.setAttribute('aria-hidden','true');
  _restorePageAfterModal();

  const toggle = document.getElementById('rs-header-login-toggle');
  if (toggle) try { toggle.focus(); } catch(_) {}
}

// expose for console testing
window.openModal = openModal;
window.closeModal = closeModal;

// ---------------------- Auth Helpers ----------------------
async function checkExistingByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id,email')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return !!data;
  } catch { return null; }
}

async function signInWithPassword(email, password) {
  try {
    return await supabase.auth.signInWithPassword({ email, password });
  } catch (e) {
    return { error: e };
  }
}

async function signUpWithEmail(email, password, meta = {}) {
  try {
    return await supabase.auth.signUp({ email, password, options: { data: meta }});
  } catch (e) {
    return { error: e };
  }
}

// ---------------------- Modal Wiring ----------------------
function setupAuthModal() {
  console.log("setupAuthModal running");

  const toggle = document.getElementById('rs-header-login-toggle');
  const modal  = document.getElementById('rs-auth-modal');

  if (!toggle || !modal) {
    console.warn("Modal or toggle not found");
    return;
  }

  // Ensure modal has correct flex classes (center fix)
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "none";
  modal.style.zIndex = "1200";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";


  // form elements
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

  // open modal
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Login/Signup toggle clicked");
    openModal({force:true});
    showStep('rs-step-enter');
    identifierInput.value = "";
    identifierError.textContent = "";
    setTimeout(() => identifierInput.focus(), 120);
  });

  // close buttons
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  }));

  // outside click
  document.addEventListener('mousedown', (ev) => {
    const m = $('#rs-auth-modal');
    if (!m || m.classList.contains('hidden')) return;

    const panel = m.querySelector('.rs-modal-panel');
    if (!panel) return;

    if (!panel.contains(ev.target)) {
      console.log("Click outside → close");
      closeModal();
    }
  });

  // escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // go back
  backToEnter?.addEventListener('click', (e) => {
    e.preventDefault();
    showStep('rs-step-enter');
  });

  // identifierNext
  identifierNext?.addEventListener('click', async (e) => {
    e.preventDefault();
    identifierError.textContent = '';

    const raw = identifierInput.value.trim();
    if (!raw) {
      identifierError.textContent = 'Please enter your email or mobile number';
      return;
    }

    // mobile branch
    if (/^\d{10,}$/.test(raw)) {
      try {
        const { data } = await supabase
          .from('customers')
          .select('email,phone')
          .eq('phone', raw)
          .limit(1)
          .maybeSingle();

        if (data?.email) {
          knownEmailText.textContent = data.email;
          passwordInput.value = "";
          showStep('rs-step-password');
        } else {
          signupEmail.value = "";
          signupName.value = "";
          signupPassword.value = "";
          showStep('rs-step-signup');
          signupName.focus();
        }
      } catch {
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
      passwordInput.value = "";
      showStep('rs-step-password');
      passwordError.textContent = "";
    } else if (exists === false) {
      signupEmail.value = email;
      signupName.value = "";
      signupPassword.value = "";
      showStep('rs-step-signup');
      signupPassword.focus();
    } else {
      // fallback
      knownEmailText.textContent = email;
      passwordInput.value = "";
      showStep('rs-step-password');
    }
  });

  // Sign In
  signinBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    passwordError.textContent = "";

    const email = knownEmailText.textContent.trim();
    const pw = passwordInput.value.trim();

    if (!email || !pw) {
      passwordError.textContent = "Enter your password";
      return;
    }

    signinBtn.disabled = true;
    const res = await signInWithPassword(email, pw);
    signinBtn.disabled = false;

    if (res.error) {
      passwordError.textContent = res.error.message || "Sign in failed";
      return;
    }

    closeModal();

    const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
    window.location.href = decodeURIComponent(rt);
  });

  // Sign Up
  signupBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    signupError.textContent = "";

    const email = signupEmail.value.trim();
    const name  = signupName.value.trim();
    const pw    = signupPassword.value.trim();

    if (!email || !name || !pw) {
      signupError.textContent = "Fill name, email and password";
      return;
    }
    if (pw.length < 6) {
      signupError.textContent = "Password must be at least 6 characters";
      return;
    }

    signupBtn.disabled = true;
    const res = await signUpWithEmail(email, pw, { full_name: name });
    signupBtn.disabled = false;

    if (res.error) {
      signupError.textContent = res.error.message || "Signup failed";
      return;
    }

    closeModal();
    const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
    window.location.href = decodeURIComponent(rt);
  });

  // cancel signup
  cancelSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    showStep('rs-step-enter');
  });
}

// show correct step
function showStep(id) {
  $all('.rs-step').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

// ---------------------- Header UI (login / logout) ----------------------
export function renderHeaderExtras() {
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  setupAuthModal();

  const toggle = document.getElementById('rs-header-login-toggle');
  const logoutBtn = document.getElementById('rs-logout-btn');

  function setUi(loggedIn) {
    if (toggle) toggle.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
  }

  async function refreshAuthUI() {
    try {
      const res = await supabase.auth.getUser();
      const user = res?.data?.user || null;
      setUi(!!user);
      if (user) return;
    } catch {}

    // fallback local token
    try {
      const storageKey = supabase.storageKey ||
        ('sb-' + (supabase.supabaseUrl || '')
        .replace(/https?:\/\//,'')
        .split('.')[0] + '-auth-token');

      const raw = localStorage.getItem(storageKey);
      if (!raw) { setUi(false); return; }

      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }

      const token = parsed?.access_token ||
                    parsed?.currentSession?.access_token ||
                    parsed?.value?.access_token;

      if (!token) { setUi(false); return; }

      const url = supabase.supabaseUrl.replace(/\/$/,'') + '/auth/v1/user';
      const r = await fetch(url, {
        headers: { 'Authorization':'Bearer '+token, 'apikey': supabase.supabaseKey },
        cache: 'no-store'
      });

      setUi(r.status === 200);
    } catch {
      setUi(false);
    }
  }

  try {
    supabase.auth.onAuthStateChange(() => refreshAuthUI());
  } catch {}

  refreshAuthUI();

  logoutBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut().catch(()=>{});
    alert("You have been logged out.");
    window.location.href = "/";
  });
}

// auto-run
renderHeaderExtras();
