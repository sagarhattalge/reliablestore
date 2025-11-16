# ReliableStore - GitHub Pages static e-commerce template

This repo is a simple static e-commerce template (HTML/CSS/JS) intended for GitHub Pages. It uses localStorage for a client-side cart and expects payment links (Razorpay / PayPal / Stripe Payment Links) to be provided from your payment provider's dashboard.

## Quick deploy steps (summary)
1. Create a public GitHub repo (you already did: `reliablestore`).
2. Upload these files to the repo (or push via git).
3. In repo Settings → Pages → select main branch (root) and set custom domain to `www.reliablestore.in`.
4. Configure DNS (A records for apex and CNAME for www). See the README in the repository on how to add DNS records.

## Payment setup
Replace the placeholder links in `assets/js/cart.js` where it says:
- `#replace-with-razorpay-payment-link`
- `#replace-with-paypal-link`

with real payment links you create in your payment provider's dashboard.

 rebuild
upd
 
 
 
