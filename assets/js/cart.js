(async function(){
  const products = await fetch('products.json').then(r=>r.json()).catch(()=>[])
  const tpl = document.getElementById('product-template')
  const productsEl = document.getElementById('products')
  const cartKey = 'reliable_cart_v1'

  function renderProducts(){
    products.forEach(p=>{
      const el = tpl.content.cloneNode(true)
      el.querySelector('.product-image').src = p.image || 'https://via.placeholder.com/400x300?text='+encodeURIComponent(p.name)
      el.querySelector('.product-image').alt = p.name
      el.querySelector('.product-title').textContent = p.name
      el.querySelector('.price').textContent = (p.price).toFixed(2)
      const btn = el.querySelector('.add-to-cart')
      btn.addEventListener('click', ()=>{ addToCart(p.id) })
      productsEl.appendChild(el)
    })
  }

  function getCart(){ return JSON.parse(localStorage.getItem(cartKey)||'{}') }
  function saveCart(c){ localStorage.setItem(cartKey, JSON.stringify(c)); updateCartUI() }

  function addToCart(id){ const c=getCart(); c[id]= (c[id]||0)+1; saveCart(c) }
  function removeFromCart(id){ const c=getCart(); delete c[id]; saveCart(c) }
  function changeQty(id,qty){ const c=getCart(); if(qty<=0) delete c[id]; else c[id]=qty; saveCart(c) }

  function updateCartUI(){
    const c = getCart();
    const itemsEl = document.getElementById('cart-items'); itemsEl.innerHTML=''
    let total=0; let count=0
    for(const id in c){
      const qty = c[id]
      const prod = products.find(x=>x.id==id)
      if(!prod) continue
      const li = document.createElement('li')
      li.innerHTML = `<span>${prod.name} x ${qty}</span><span>₹${(prod.price*qty).toFixed(2)}</span>`
      itemsEl.appendChild(li)
      total += prod.price*qty
      count += qty
    }
    document.getElementById('cart-total').textContent = total.toFixed(2)
    document.getElementById('cart-count').textContent = count

    const razor = document.getElementById('checkout-razorpay')
    const paypal = document.getElementById('checkout-paypal')
    razor.href = '#replace-with-razorpay-payment-link'
    paypal.href = '#replace-with-paypal-link'
  }

  renderProducts(); updateCartUI()
  window._reliable = { getCart, addToCart, removeFromCart, changeQty }
})()
