// Shared cart helpers and server-sync helpers
// Place at: /assets/js/cart.js
export const CART_KEY = 'rs_cart_v1';

export function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}'); }
  catch (e) { return {}; }
}
export function setCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  catch (e) { console.warn('setCart error', e); }
  // trigger same-tab listeners (native storage event doesn't fire in same tab)
  try { window.dispatchEvent(new Event('storage')); } catch (e) {}
}
export function clearCart() {
  try { localStorage.removeItem(CART_KEY); } catch (e) {}
  try { window.dispatchEvent(new Event('storage')); } catch (e) {}
}
export function cartTotalCount() {
  const c = getCart();
  return Object.values(c).reduce((s, i) => s + (i.qty || 0), 0);
}

/* Merge strategy: serverCart preferred, but quantities are summed */
export function mergeCarts(serverCart, localCart) {
  const merged = Object.assign({}, serverCart || {});
  for (const k of Object.keys(localCart || {})) {
    if (!merged[k]) merged[k] = localCart[k];
    else merged[k].qty = (merged[k].qty || 0) + (localCart[k].qty || 0);
  }
  return merged;
}

/* Server sync helpers expect a working supabase client imported as `supabase` */
export async function saveCartForUser(userId, supabase) {
  if (!userId) return;
  const items = getCart();
  try {
    await supabase.from('carts').upsert({ user_id: userId, items }).throwOnError();
  } catch (err) {
    console.warn('saveCartForUser error', err);
  }
}
export async function loadCartForUser(userId, supabase) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.from('carts').select('items').eq('user_id', userId).single();
    if (error) {
      // Not found vs actual error: log and return null
      console.warn('loadCartForUser supabase error', error);
      return null;
    }
    return data?.items || null;
  } catch (err) {
    console.warn('loadCartForUser exception', err);
    return null;
  }
}
