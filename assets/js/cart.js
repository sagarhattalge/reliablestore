// /assets/js/cart.js
// Shared cart helpers and server-sync helpers (ES module + compatibility shim).
// Drop this file at: /assets/js/cart.js
// Usage (ESM): import { getCart, setCart, cartTotalCount, mergeCarts, saveCartForUser, loadCartForUser } from '/assets/js/cart.js';
// Compatibility: window.RSCart will be created if not present.

export const CART_KEY = 'rs_cart_v1';

/**
 * Read cart object from localStorage.
 * Always returns an object (possibly empty).
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY) || '{}';
    // defensive parse: ensure we return an object, not array/primitive
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    // If parse fails, return empty object and log once.
    console.warn('getCart parse error — returning empty cart', e);
    return {};
  }
}

/**
 * Write cart object to localStorage and notify same-tab listeners.
 * Accepts any serializable object. Non-objects will be coerced.
 */
export function setCart(cart) {
  try {
    const safe = (cart && typeof cart === 'object') ? cart : {};
    localStorage.setItem(CART_KEY, JSON.stringify(safe));
  } catch (e) {
    console.warn('setCart error', e);
  }
  // Native "storage" event does not fire in same tab; dispatch synthetic event for in-page listeners.
  try { window.dispatchEvent(new Event('storage')); } catch (e) { /* ignore */ }
}

/** Remove cart from localStorage and notify listeners */
export function clearCart() {
  try { localStorage.removeItem(CART_KEY); } catch (e) { console.warn('clearCart error', e); }
  try { window.dispatchEvent(new Event('storage')); } catch (e) { /* ignore */ }
}

/** Return total item count (sum of qty). All arithmetic explicit and safe. */
export function cartTotalCount() {
  const cart = getCart();
  // iterate and sum digits-by-digit (safe)
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

/**
 * Merge carts
 * Strategy: serverCart is the base; localCart quantities are added to serverCart when keys overlap.
 * Both args are plain objects keyed by item id.
 */
export function mergeCarts(serverCart, localCart) {
  const s = (serverCart && typeof serverCart === 'object') ? serverCart : {};
  const l = (localCart && typeof localCart === 'object') ? localCart : {};
  const merged = Object.assign({}, s);

  Object.keys(l).forEach(k => {
    const localItem = l[k];
    if (!merged[k]) {
      // copy local item (shallow)
      merged[k] = Object.assign({}, localItem);
    } else {
      // both exist: sum quantities (fallback defaults)
      const existingQty = Number(merged[k].qty || 0);
      const localQty = Number(localItem.qty || 0);
      const sum = (Number.isFinite(existingQty) ? existingQty : 0) + (Number.isFinite(localQty) ? localQty : 0);
      merged[k] = Object.assign({}, merged[k], { qty: Math.max(0, Math.floor(sum)) });
    }
  });

  return merged;
}

/**
 * saveCartForUser(userId, supabase?)
 * - If a supabase client is provided, uses it; otherwise tries to use global `supabase`.
 * - Upserts a row into `public.carts` with { user_id, items }.
 */
export async function saveCartForUser(userId, supabaseClient) {
  if (!userId) return;
  const supa = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
  if (!supa) {
    console.warn('saveCartForUser: no supabase client available');
    return;
  }

  const items = getCart();
  try {
    // prefer minimal returning to save bandwidth; if .throwOnError exists we use it, otherwise check error.
    const resp = await supa.from('carts').upsert({ user_id: userId, items });
    if (resp.error) {
      console.warn('saveCartForUser supabase error', resp.error);
    }
    return resp;
  } catch (err) {
    console.warn('saveCartForUser exception', err);
    return null;
  }
}

/**
 * loadCartForUser(userId, supabase?)
 * - Returns saved items object or null if not found or error.
 */
export async function loadCartForUser(userId, supabaseClient) {
  if (!userId) return null;
  const supa = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
  if (!supa) {
    console.warn('loadCartForUser: no supabase client available');
    return null;
  }

  try {
    const { data, error } = await supa.from('carts').select('items').eq('user_id', userId).single();
    if (error) {
      // if row not found, data will be null and error will indicate not found; treat as null
      console.warn('loadCartForUser supabase returned error', error);
      return null;
    }
    return data?.items || null;
  } catch (err) {
    console.warn('loadCartForUser exception', err);
    return null;
  }
}

/* =========================
   Compatibility shim: expose window.RSCart
   Do not overwrite if already present.
   Provides backward-compatible API used by legacy code.
   ========================= */
(function exposeCompat() {
  if (typeof window === 'undefined') return;

  window.RSCart = window.RSCart || {};

  // Populate missing methods only (do not overwrite)
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
