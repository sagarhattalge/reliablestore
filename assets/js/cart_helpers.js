// assets/js/cart_helpers.js
export function addToCart(product) {
  // product = { id, title, price, image }
  const key = 'rs_cart_v1';
  const raw = localStorage.getItem(key);
  const cart = raw ? JSON.parse(raw) : {};
  if (!cart[product.id]) {
    cart[product.id] = { ...product, qty: 1 };
  } else {
    cart[product.id].qty = (cart[product.id].qty || 0) + 1;
  }
  localStorage.setItem(key, JSON.stringify(cart));
  // update header cart count (header script listens for storage events)
  window.dispatchEvent(new Event('storage'));
  // navigate to cart page or show notification
  window.location.href = '/cart.html';
}
