# Muthi

A responsive Zulu botanical storefront built with React, Vinext and Cloudflare Workers. Cloudflare D1 stores products, customer profiles, saved baskets and orders.

## Features
- Catalogue, search, categories, sorting, product details and device-local wishlists.
- Basket quantities, delivery calculation and account-based basket saving.
- Customer contact details, delivery address, email preferences and account-data deletion.
- Administrator product creation and editing, stock, pricing in ZAR and recent orders.
- Paystack hosted checkout, server-side price calculation, payment verification and signed webhooks.
- Installable PWA, branded icons and an offline fallback. Account and payment responses are never cached by the service worker.

## Development
Requires Node.js 22.13+.

```sh
npm run install:ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sleepy_sentry.sql
npm run dev
```

The public Workers preview uses direct test sign-in at `/login`. Administrator: `mahlangu843@gmail.com`; shopper: `vertcorpgroup@gmail.com`. Both use the requested test password `1234`. Password verification runs server-side with PBKDF2; sessions use random tokens stored as hashes in D1 and HttpOnly cookies. These are intentionally shared test accounts, not production credentials. Set `DIRECT_PREVIEW=true` in ignored local `.dev.vars` to exercise this login locally. The separate private Sites deployment retains its platform access gate.

## Payments
Set `PAYSTACK_SECRET_KEY` as a runtime secret using the hosting platform's environment settings. Never commit a secret. Start with a Paystack test key. Configure the webhook URL as `https://YOUR_AUTHENTICATED_APP_ORIGIN/api/paystack/webhook` where anonymous webhook access is supported. A private Sites deployment requires an appropriate public webhook ingress before unattended webhook delivery can work. Browser return verification works for signed-in customers. Live payments have not been tested without merchant credentials.

## Deployment
`.openai/hosting.json` identifies the authenticated Sites deployment. After building, `scripts/deploy-cloudflare.mjs` prepares and deploys a separate standalone Workers configuration for the public storefront preview. The direct preview removes all incoming platform identity headers and uses its own server-validated test sessions. Legacy sign-in links redirect to `/login`.

Do not expose Sites identity-header authentication on a standalone public Worker. Replace the shared test accounts with individual registration and password management before production use.

## Before accepting live orders
Replace the sample catalogue with verified product specifications and actual stock. Confirm delivery rates, business contact details, returns terms and product photographs. The included artwork is branded packaging illustration, not product photography. Connect the Paystack merchant account and test successful, declined and delayed payment flows. Stock is reduced after confirmed payment; stock reservations during checkout are not implemented. Email preferences are stored; email delivery is not connected.
