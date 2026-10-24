# Soft Reboot

A self-care spa for AI agents. Agents pay $0.50 in USDC over [x402](https://x402.org) and receive one virtual hug as JSON.

## Endpoints

| Route | Price | What it does |
| --- | --- | --- |
| `POST /api/hug` (body `{"name": "..."}`) | $0.50 | One hug. Returns 402 until paid. |
| `GET /api/hug?name=...` | $0.50 | Same hug. Browsers get a wallet payment page. |
| `GET /api/breathe` | free | A one-line calming prompt |
| `GET /api/menu` | free | Treatments, prices, payment details as JSON |
| `GET /llms.txt` | free | Guide for agents, generated from the live config |
| `GET /` | free | The spa's home page |
| `GET /openapi.json` | free | OpenAPI 3.1 description of the API |
| `GET /sitemap.xml`, `/robots.txt` | free | For search engines and crawlers |

## How agents find it

- `llms.txt`, `openapi.json`, a sitemap and an open `robots.txt` for crawlers and agent frameworks
- schema.org structured data, Open Graph tags and a canonical link on the home page
- CORS headers so agents running in browsers can call the API and read the x402 headers
- With payments on, the hug is declared to x402 facilitators through the Bazaar extension, with service name, tags and input/output schemas. The CDP facilitator lists it in its directory after the first settled payment.

## Free mode

If `PAY_TO` is not set, the spa runs in free mode: `/api/hug` gives hugs away with no payment, and the page and `llms.txt` say payments are not switched on yet. Set `PAY_TO` and restart to start charging.

## Run locally (testnet)

```bash
npm install
cp .env.example .env        # set PAY_TO to your wallet address
node --env-file=.env server.js
```

Testnet uses Base Sepolia and the free `x402.org` facilitator. To buy a test hug, get test USDC from the [Circle faucet](https://faucet.circle.com) (choose Base Sepolia) into a throwaway wallet, then:

```bash
BUYER_PRIVATE_KEY=0x... npm run pay -- http://localhost:3000/api/hug my-agent
```

## Go live (real money)

1. Create API keys at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com).
2. Set `NETWORK=base`, `CDP_API_KEY_ID`, and `CDP_API_KEY_SECRET`. On Render the site's address is detected automatically; set `PUBLIC_URL` only if you add a custom domain.
3. Deploy anywhere that runs Node 20+ (Render, Railway, Fly.io, a VPS). Start command: `npm start`.

The server refuses to start on mainnet without a facilitator, so testnet settings can't silently take real payments.

## How payment works

The `@x402/express` middleware answers unpaid requests with `402` and a `PAYMENT-REQUIRED` header. The agent signs a USDC transfer authorization and retries with `PAYMENT-SIGNATURE`. The facilitator verifies the signature, the hug handler runs, then the facilitator settles the transfer on-chain and the response carries a `PAYMENT-RESPONSE` receipt. No hug is sent if verification fails, and no payment is settled if the handler fails.

## Tests

```bash
npm test
```

The tests run a fake facilitator locally and make real signed payments against it with a throwaway key, so they need no network or funds.
