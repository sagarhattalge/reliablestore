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

  // wire buttons
  document.getElementById('btn_cart').addEventListener('click', () => {
    window.location.href = '/cart.html';
  });

  document.getElementById('btn_login').addEventListener('click', () => {
    const returnTo = encodeURIComponent(getReturnTo());
    window.location.href = '/login.html?returnTo=' + returnTo;
  });

  document.getElementById('btn_signup').addEventListener('click', () => {
    const returnTo = encodeURIComponent(getReturnTo());
    window.location.href = '/signup.html?returnTo=' + returnTo;
  });

  document.getElementById('btn_logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    // show logout message then redirect home
    alert('You have been logged out.');
    window.location.href = '/';
  });

  // show/hide login/signup/logout based on auth state
  const updateAuthUI = async () => {
    const { data } = await supabase.auth.getUser();
    const loggedIn = !!data?.user;
    document.getElementById('btn_login').classList.toggle('hidden', loggedIn);
    document.getElementById('btn_signup').classList.toggle('hidden', loggedIn);
    document.getElementById('btn_logout').classList.toggle('hidden', !loggedIn);
  };

  // update cart count
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  updateAuthUI();
  supabase.auth.onAuthStateChange(() => updateAuthUI());
}

// Auto-render header on import
renderHeader();
