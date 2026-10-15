# THE MILLETO India — 200 g flavour menu

Separate India storefront; independent of the Wageningen pickup shop.

## Menu (all prices per 200 g pack)
- Plain Millet Cookies — ₹115
- Coconut Millet Cookies — ₹115
- Chocolate Millet Cookies — ₹115
- Jeera Millet Cookies — ₹120
- Coffee Millet Cookies — ₹115
- Dryfruit Elaichi Millet Cookies — ₹185

The storefront catalogue (`app.js`) and authoritative server-side prices (`functions/api/create-payment.js`) match. The sample flat shipping fee remains ₹80 and must be confirmed before launch.

## Deploy to GitHub + Cloudflare Pages
1. Create a separate GitHub repository named `the-milleto-india`.
2. Extract the ZIP and upload the **contents** of this folder to the repository root (not the ZIP itself).
3. Connect the repository to Cloudflare Pages. Framework preset: None; production branch: `main`; build command blank; output directory `.`.
4. Create a Cloudflare D1 database and bind it to Pages as `DB`.
5. Run `schema.sql` in the D1 console.
6. Add encrypted environment secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Use test credentials first.
7. Configure a Razorpay test-mode webhook at `https://YOUR-PROJECT.pages.dev/api/payment-webhook` for `payment.captured`, using the same webhook secret in Cloudflare.
8. Test order creation, captured payment verification, webhook handling and D1 updates in test mode.

## Important
This starter does not mean live payments are configured. Get merchant approval and test end-to-end before enabling live payments. Replace contact placeholders, confirm ingredients/allergens, pack labels, courier rates/PIN-code serviceability, shipping and refund terms, privacy policy and applicable food-business compliance. Add abuse protection, order management, reconciliation and customer notifications before production.
