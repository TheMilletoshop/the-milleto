# THE MILLETO India — Cloudflare Pages starter

Separate India storefront for THE MILLETO. This project is independent of the Wageningen pickup shop.

## Included

- Responsive Indian-inspired storefront (`index.html`, `styles.css`, `app.js`)
- Sample millet-cookie catalogue and cart
- Cloudflare Pages Functions for Razorpay order creation, payment verification and webhook handling
- D1 order schema (`schema.sql`)
- Privacy-note starter (`privacy.html`)

## Important before launch

**This is a starter project, not a ready-to-take-live-payments shop.** Prices, pack sizes, shipping fee, product claims, contact details, courier coverage and legal information are placeholders. Test the full flow in Razorpay Test Mode first. Do not enable live payments until your merchant account is approved and the complete checkout and fulfilment flow has been reviewed.

The catalogue and prices are duplicated in `app.js` and `functions/api/create-payment.js`. Keep these in sync. The sample shipping fee is ₹80 and is duplicated in the browser display and server calculation. The server-side amount is authoritative.

## Deploy via GitHub + Cloudflare Pages

1. Create a **new** GitHub repository named `the-milleto-india`.
2. Extract this ZIP on your computer and upload the *contents* of this folder to the repository root. Do not upload only the ZIP file.
3. In Cloudflare Dashboard, create a Pages project connected to this new repository.
4. Build settings:
   - Framework preset: None
   - Build command: leave empty (if the dashboard requires a command, use `exit 0`)
   - Build output directory: `/` or `.` as accepted by the dashboard
   - Production branch: `main`
5. Create a Cloudflare D1 database, for example `milleto-india-orders`.
6. In Pages project settings, bind the D1 database with variable name `DB`. Run `schema.sql` in that database's SQL console.
7. In Pages settings, add these as encrypted secrets:
   - `RAZORPAY_KEY_ID` — test key ID while testing
   - `RAZORPAY_KEY_SECRET` — test key secret while testing
   - `RAZORPAY_WEBHOOK_SECRET` — secret configured for the Razorpay webhook
8. Redeploy after setting bindings/secrets.
9. Configure Razorpay Test Mode webhook endpoint:
   `https://YOUR-PROJECT.pages.dev/api/payment-webhook`
   Subscribe to `payment.captured`. Use the same webhook secret in Razorpay and Cloudflare.
10. Test `/api/create-payment`, Razorpay test checkout, `/api/verify-payment`, and the webhook. Confirm the D1 order status changes to `paid` only for captured payments.

## Function routes

- `POST /api/create-payment`
- `POST /api/verify-payment`
- `POST /api/payment-webhook`

## Security and production work still required

- Add rate limiting and bot/abuse protection.
- Add order lookup for customers, order expiry and reconciliation.
- Add refunds, cancellations, delayed/failed payments and support workflows.
- Add an authenticated admin/order-management view; do not expose customer order data publicly.
- Validate courier PIN-code serviceability and actual shipping charges on the server.
- Add idempotent event tracking and review race conditions in payment/webhook updates.
- Confirm payment capture settings, account eligibility and live keys in Razorpay.
- Add accurate FSSAI/business details, product ingredients and allergens, food-label information, shipping/return/refund terms, privacy policy and customer support details as applicable.
- Replace `hello@example.com` and all sample product prices/content.
- Consider a transactional email service for order confirmations.

## Product catalogue

Sample prices in this starter:
- Cranberry Pistachio: ₹149
- Chocolate Millet Cookies: ₹129
- Coconut Cookies: ₹119
- Cashew Cardamom: ₹149

These are examples only. Update the catalogue to match your actual pack weights and prices. The checkout currently charges a sample ₹80 shipping fee for every non-empty basket; implement your actual courier pricing before launch.

## Local preview

You can open `index.html` directly to preview the design and cart, but checkout requires Cloudflare Pages Functions, a D1 binding and Razorpay credentials. Direct-file preview will not process payments.
