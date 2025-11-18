// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

// Small, cacheable header script. Loads as module at end of page.
const siteHeaderHtml = `
  <style>
    .rs-header{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;background:#fff;border-bottom:1px solid #eee;position:sticky;top:0;z-index:60}
    .rs-left{display:flex;align-items:center;gap:12px}
    .rs-logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit}
    .rs-logo img{height:36px}
    .rs-nav{display:flex;gap:8px;align-items:center}
    .rs-btn{background:#FE9900;color:#fff;padding:8px 12px;border-radius:8px;border:0;cursor:pointer}
    .rs-link{background:#fff;border:1px solid #ddd;padding:7px 10px;border-radius:8px;cursor:pointer}
    .hidden{display:none!important}
    @media (max-width:640px){ .rs-nav{gap:6px} }
  </style>
  <header class="rs-header" aria-label="site header">
    <div class="rs-left">
      <a class="rs-logo" href="/" aria-label="ReliableStore home">
        <img src="/assets/icons/header-logo.png" alt="ReliableStore logo" />
        <strong>ReliableStore</strong>
      </a>
    </div>
    <nav class="rs-nav" role="navigation" aria-label="main navigation">
      <button id="btn_cart" class="rs-link" aria-label="cart">Cart (<span id="cart_count">0</span>)</button>
      <button id="btn_login" class="rs-link">Login</button>
      <button id="btn_signup" class="rs-link">Sign up</button>
      <button id="btn_logout" class="rs-btn hidden">Logout</button>
    </nav>
  </header>
`;

function getReturnTo() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function readCart() {
  try { return JSON.parse(localStorage.getItem('rs_cart_v1') || '{}'); } catch(e){ return {}; }
}
function cartTotalCount() {
  const cart = readCart();
  return Object.values(cart).reduce((s,p)=> s + (p.qty||0), 0);
}
function setCartCount(n){ const el = document.getElementById('cart_count'); if(el) el.innerText = String(n||0); }

export function renderHeader() {
  if (document.getElementById('rs_header_root')) return;
  const div = document.createElement('div');
  div.id = 'rs_header_root';
  div.innerHTML = siteHeaderHtml;
  document.body.insertBefore(div, document.body.firstChild);

  document.getElementById('btn_cart').addEventListener('click', () => window.location.href = '/cart.html');

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
    // friendly toast (simple)
    try { alert('You have been logged out.'); } catch(e) {}
    window.location.href = '/';
  });

  const updateAuthUI = async () => {
    const { data } = await supabase.auth.getUser();
    const loggedIn = !!data?.user;
    document.getElementById('btn_login').classList.toggle('hidden', loggedIn);
    document.getElementById('btn_signup').classList.toggle('hidden', loggedIn);
    document.getElementById('btn_logout').classList.toggle('hidden', !loggedIn);
  };

  setCartCount(cartTotalCount());
  window.addEventListener('storage', ()=> setCartCount(cartTotalCount()));
  updateAuthUI();
  supabase.auth.onAuthStateChange(() => updateAuthUI());
}

renderHeader();
