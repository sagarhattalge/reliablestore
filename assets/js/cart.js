// /assets/js/cart.js
// Shared cart helpers and server-sync helpers (ES module + compatibility shim).
// Drop this file at: /assets/js/cart.js
// Usage (ESM): import { getCart, setCart, cartTotalCount, mergeCarts, saveCartForUser, loadCartForUser } from '/assets/js/cart.js';
// Compatibility: window.RSCart will be created if not present.

export const CART_KEY = 'rs_cart_v1';

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY) || '{}';
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    console.warn('getCart parse error — returning empty cart', e);
    return {};
  }
}

export function setCart(cart) {
  try {
    const safe = (cart && typeof cart === 'object') ? cart : {};
    localStorage.setItem(CART_KEY, JSON.stringify(safe));
  } catch (e) {
    console.warn('setCart error', e);
  }
  try { window.dispatchEvent(new Event('storage')); } catch (e) {}
}

export function clearCart() {
  try { localStorage.removeItem(CART_KEY); } catch (e) { console.warn('clearCart error', e); }
  try { window.dispatchEvent(new Event('storage')); } catch (e) {}
}

export function cartTotalCount() {
  const cart = getCart();
  let total = 0;
  const keys = Object.keys(cart);
  for (let i = 0; i < keys.length; i++) {
    const it = cart[keys[i]];
    const q = Number((it && it.qty) || 0);
    if (!Number.isFinite(q)) continue;
    total += Math.floor(q);
  }
  return total;
}

export function mergeCarts(serverCart, localCart) {
  const s = (serverCart && typeof serverCart === 'object') ? serverCart : {};
  const l = (localCart && typeof localCart === 'object') ? localCart : {};
  const merged = Object.assign({}, s);

  Object.keys(l).forEach(k => {
    const localItem = l[k];
    if (!merged[k]) {
      merged[k] = Object.assign({}, localItem);
    } else {
      const existingQty = Number(merged[k].qty || 0);
      const localQty = Number(localItem.qty || 0);
      const sum = (Number.isFinite(existingQty) ? existingQty : 0) + (Number.isFinite(localQty) ? localQty : 0);
      merged[k] = Object.assign({}, merged[k], { qty: Math.max(0, Math.floor(sum)) });
    }
  });

  return merged;
}

/**
 * saveCartForUser(userId, supabaseClient?)
 * - uses maybeSingle-safe upsert via client
 */
export async function saveCartForUser(userId, supabaseClient) {
  if (!userId) return null;
  const supa = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
  if (!supa) {
    console.warn('saveCartForUser: no supabase client available');
    return null;
  }

  const items = getCart();
  try {
    // upsert; PostgREST will succeed even if row exists or not
    const { data, error } = await supa.from('carts').upsert({ user_id: userId, items }).select();
    if (error) {
      console.warn('saveCartForUser supabase error', error);
      return { error };
    }
    return { data };
  } catch (err) {
    console.warn('saveCartForUser exception', err);
    return { error: err };
  }
}

/**
 * loadCartForUser(userId, supabaseClient?)
 * - uses maybeSingle() to avoid the PGRST116 error when row missing
 * - returns items object or null
 */
export async function loadCartForUser(userId, supabaseClient) {
  if (!userId) return null;
  const supa = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
  if (!supa) {
    console.warn('loadCartForUser: no supabase client available');
    return null;
  }

  try {
    // use maybeSingle so we get null when no row exists (avoids PGRST116)
    const { data, error } = await supa.from('carts').select('items').eq('user_id', userId).maybeSingle();
    if (error) {
      // log but treat as null (fail-safe)
      console.warn('loadCartForUser supabase error', error);
      return null;
    }
    if (!data) return null;
    return data.items || null;
  } catch (err) {
    console.warn('loadCartForUser exception', err);
    return null;
  }
}

/* compatibility shim */
(function exposeCompat() {
  if (typeof window === 'undefined') return;

  window.RSCart = window.RSCart || {};

  if (typeof window.RSCart.readCart !== 'function') window.RSCart.readCart = getCart;
  if (typeof window.RSCart.writeCart !== 'function') window.RSCart.writeCart = setCart;
  if (typeof window.RSCart.clearCart !== 'function') window.RSCart.clearCart = clearCart;
  if (typeof window.RSCart.cartTotalCount !== 'function') window.RSCart.cartTotalCount = cartTotalCount;
  if (typeof window.RSCart.setCartCountUi !== 'function') {
    window.RSCart.setCartCountUi = function (n) {
      try {
        const el1 = document.getElementById('cart-count');
        const el2 = document.getElementById('cart_count');
        if (el1) el1.innerText = String(n || 0);
        if (el2) el2.innerText = String(n || 0);
      } catch (e) { /* ignore */ }
    };
  }
  if (typeof window.RSCart.mergeCarts !== 'function') window.RSCart.mergeCarts = mergeCarts;
  if (typeof window.RSCart.saveCartForUser !== 'function') window.RSCart.saveCartForUser = saveCartForUser;
  if (typeof window.RSCart.loadCartForUser !== 'function') window.RSCart.loadCartForUser = loadCartForUser;
})();
