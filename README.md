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
reverted contact form
minor updations in contact form
updated
 
README - ReliableStore (deployment checklist)

1. Replace Supabase keys
   - Edit assets/js/supabase_client.js
   - Set SUPABASE_URL and SUPABASE_ANON_KEY (public anon key).

2. Images & icons
   - Add /assets/icons/header-logo.png
   - Add product images under /assets/images/p1.jpg, p2.jpg, p3.jpg
   - Add CSS at /assets/css/site.css if you want global styles.

3. Supabase setup (recommended)
   - Create `customers` table with columns from our earlier conversation (id UUID pk, email, phone, full_name, address, country, state, city, postal_code, metadata JSONB).
   - Add RLS policies we discussed so clients can upsert their own row (see earlier SQL).
   - Create Storage bucket `avatars` (optional) for profile pictures.

4. Upload files to GitHub
   - Commit and push all files to your GitHub Pages branch (main or gh-pages).
   - Wait a minute and visit https://<your-user>.github.io/<repo>/ or your custom domain.

5. Test flow
   - Open site, add product(s), go to cart, play with quantities.
   - Click Login from product or cart; sign up or sign in — you should return to the same page via returnTo param.
   - Visit profile.html to edit profile and upload avatar.

6. Troubleshooting
   - If header doesn't appear, view page source and confirm script:
     <script type="module" src="/assets/js/site_header.js"></script>
   - Ensure supabase_client.js contains correct URL & anon key.
