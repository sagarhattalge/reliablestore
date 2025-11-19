// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

const siteHeaderHtml = `
  <style>
    /* minimal header styles - adjust to fit site */
    .rs-header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:white;border-bottom:1px solid #eee;position:sticky;top:0;z-index:60}
    .rs-left{display:flex;align-items:center;gap:14px}
    .rs-logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit}
    .rs-logo img{height:36px}
    .rs-nav{display:flex;gap:10px;align-items:center}
    .rs-btn{background:#FE9900;color:#fff;padding:8px 12px;border-radius:8px;border:0;cursor:pointer}
    .rs-link{background:#fff;border:1px solid #ddd;padding:7px 10px;border-radius:8px;cursor:pointer}
    @media (max-width:640px){ .rs-nav{gap:6px} }
  </style>
  <header class="rs-header">
    <div class="rs-left">
      <a class="rs-logo" href="/">
        <img src="/assets/icons/header-logo.png" alt="logo" />
        <strong>ReliableStore</strong>
      </a>
    </div>
    <nav class="rs-nav">
      <button id="btn_cart" class="rs-link">Cart (<span id="cart_count">0</span>)</button>
      <button id="btn_login" class="rs-link">Login</button>
      <button id="btn_signup" class="rs-link">Sign up</button>
      <button id="btn_logout" class="rs-btn hidden">Logout</button>
    </nav>
  </header>
`;

function getReturnTo() {
  // preserve current path + query
  return window.location.pathname + window.location.search + window.location.hash;
}

function setCartCount(n){
  const el = document.getElementById('cart_count');
  if(el) el.innerText = String(n||0);
}

function readCart() {
  try {
    const raw = localStorage.getItem('rs_cart_v1');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch(e) { return {}; }
}

function cartTotalCount() {
  const cart = readCart();
  return Object.values(cart).reduce((s, p) => s + (p.qty || 0), 0);
}

export function renderHeader() {
  // Insert header only once
  if (document.getElementById('rs_header_root')) return;
  const div = document.createElement('div');
  div.id = 'rs_header_root';
  div.innerHTML = siteHeaderHtml;
  document.body.insertBefore(div, document.body.firstChild);

  // hide any temporary fallback header if present
  if (window.hideFallbackHeader) {
    try { window.hideFallbackHeader(); } catch(e) { /* ignore */ }
  }

  // wire buttons safely (check elements exist)
  const cartBtn = document.getElementById('btn_cart');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      window.location.href = '/cart.html';
    });
  }

  const loginBtn = document.getElementById('btn_login');
  const signupBtn = document.getElementById('btn_signup');
  const logoutBtn = document.getElementById('btn_logout');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const returnTo = encodeURIComponent(getReturnTo());
      window.location.href = '/login.html?returnTo=' + returnTo;
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      const returnTo = encodeURIComponent(getReturnTo());
      window.location.href = '/signup.html?returnTo=' + returnTo;
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
      } catch(e) {
        console.warn('Logout error', e);
      }
      // show logout message then redirect home
      try { alert('You have been logged out.'); } catch(e){ /* ignore */ }
      window.location.href = '/';
    });
  }

  // show/hide login/signup/logout based on auth state
  const updateAuthUI = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const loggedIn = !!data?.user;
      if (loginBtn) loginBtn.classList.toggle('hidden', loggedIn);
      if (signupBtn) signupBtn.classList.toggle('hidden', loggedIn);
      if (logoutBtn) logoutBtn.classList.toggle('hidden', !loggedIn);
    } catch (err) {
      // don't break rendering if supabase errors
      console.warn('updateAuthUI error', err);
    }
  };

  // update cart count
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  updateAuthUI();
  try {
    supabase.auth.onAuthStateChange(() => updateAuthUI());
  } catch(e) {
    // ignore if supabase object not ready
    console.warn('supabase.onAuthStateChange not available', e);
  }

  /* Robust fallback wiring: in case IDs differ or header html is replaced later
     This finds elements by ID, data attributes, or visible text and attaches handlers once.
  */
  function returnToEncoded() {
    return encodeURIComponent(getReturnTo() || '/');
  }

  function attachIfMatch(el, page) {
    if (!el || el.dataset?.rsWired) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/' + page + '.html?returnTo=' + returnToEncoded();
    }, { passive: true });
    el.dataset.rsWired = '1';
  }

  function findByText(regex) {
    const all = Array.from(document.querySelectorAll('a,button,[role="button"],input[type="button"]'));
    return all.find(n => regex.test((n.textContent || n.value || '').trim()));
  }

  function robustWireLoginSignup() {
    // priority: explicit IDs or existing variables above
    attachIfMatch(document.getElementById('btn_login'), 'login');
    attachIfMatch(document.getElementById('btn_signup'), 'signup');

    // fallback: data attributes if you later add them in markup
    attachIfMatch(document.querySelector('[data-rs-login]'), 'login');
    attachIfMatch(document.querySelector('[data-rs-signup]'), 'signup');

    // fallback: visible text matches (exact-ish)
    attachIfMatch(findByText(/^\s*(login|log in|sign in)\s*$/i), 'login');
    attachIfMatch(findByText(/^\s*(signup|sign up|register|create account)\s*$/i), 'signup');
  }

  // initial attempt and observe for dynamic changes
  robustWireLoginSignup();
  const mo = new MutationObserver(() => { robustWireLoginSignup(); });
  mo.observe(document.body, { childList: true, subtree: true });
}

// Auto-render header on import
renderHeader();
