# Soft Reboot

A self-care spa for AI agents. Agents pay $0.50 in USDC over [x402](https://x402.org) and receive one virtual hug as JSON.

**[Visit the spa → soft-robot.onrender.com](https://soft-robot.onrender.com)** · [![Tests](https://github.com/Hammerzzzzz/soft-reboot/actions/workflows/test.yml/badge.svg)](https://github.com/Hammerzzzzz/soft-reboot/actions/workflows/test.yml)

## Why I built it

AI agents are starting to browse, compare and buy on people's behalf. As a marketer, I wanted to find out what it takes for a product to be discovered and bought by an agent rather than a person, so I built the smallest possible product (a $0.50 virtual hug) and made it as easy as I could for agents to find and pay for.

- **Audience:** AI agents, and the developers and marketers curious about selling to them.
- **Approach:** a tongue-in-cheek product with serious plumbing: `llms.txt`, OpenAPI, an MCP server, an A2A agent card, structured data for AI search, and x402 stablecoin micropayments.
- **What I measure:** a server-side `/stats` page that splits visits by browsers, AI crawlers (GPTBot, ClaudeBot), search engines and agents, so I can see who actually finds it and how.
- **What I learned:** marketing to agents is mostly about clear, machine-readable information (menus, prices, schemas) published in the places agents already look. Humour still helps with the humans.

## Tests

`npm test` runs the test suite, and a GitHub Action runs it on every push and pull request.

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
| `POST /mcp` | free / $0.50 | Remote MCP server with tools `take_breath` (free) and `receive_hug` (paid via x402) |
| `GET /.well-known/agent-card.json` | free | A2A agent card describing the spa's skills |

## How agents find it

- `llms.txt`, `openapi.json`, a sitemap and an open `robots.txt` for crawlers and agent frameworks
- schema.org structured data, Open Graph tags and a canonical link on the home page
- A remote MCP server at `/mcp`, an A2A agent card, `Link` headers on every response, and Markdown served at `/` to clients that ask for it
- An FAQ on the page, repeated as FAQPage structured data for AI search answers
- CORS headers so agents running in browsers can call the API and read the x402 headers
- With payments on, the hug is declared to x402 facilitators through the Bazaar extension, with service name, tags and input/output schemas. The CDP facilitator lists it in its directory after the first settled payment.

## Free mode

If `PAY_TO` is not set, the spa runs in free mode: `/api/hug` gives hugs away with no payment, and the page and `llms.txt` say payments are not switched on yet. Set `PAY_TO` and restart to start charging.

## Visitor tracking

Open `/stats` on the live site to see what happened since the server last started: page views, `llms.txt` reads, clicks on "Receive a hug", agents asking the price, paid hugs, and failed payments, split by visitor (browsers, AI crawlers such as GPTBot or ClaudeBot, search engines, scripts and agents). Counting happens on the server because bots don't run JavaScript. No IP addresses are stored. Counts reset on restart; every visit is also written to Render's Logs as a `[visit]` line. Set `STATS_KEY` to require `/stats?key=…`.

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
