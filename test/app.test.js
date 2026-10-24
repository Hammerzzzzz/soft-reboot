import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { loadConfig } from "../src/config.js";
import { createApp } from "../src/app.js";
import { cleanName } from "../src/hugs.js";

const PAY_TO = "0x1111111111111111111111111111111111111111";
const NETWORK = "eip155:84532";
const buyer = privateKeyToAccount(generatePrivateKey());

// Stands in for a real facilitator: accepts any signed payload whose requirements match
// what the server asked for, and records what it settled.
const settled = [];
let rejectNext = false;
function startFakeFacilitator() {
  const app = express();
  app.use(express.json());
  app.get("/supported", (req, res) =>
    res.json({ kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }], extensions: [], signers: {} }),
  );
  app.post("/verify", (req, res) => {
    const { paymentPayload, paymentRequirements } = req.body;
    const auth = paymentPayload?.payload?.authorization;
    const ok =
      !rejectNext &&
      paymentRequirements.payTo === PAY_TO &&
      auth?.to?.toLowerCase() === PAY_TO &&
      auth?.value === paymentRequirements.amount;
    rejectNext = false;
    res.json(ok ? { isValid: true, payer: auth.from } : { isValid: false, invalidReason: "invalid_payload" });
  });
  app.post("/settle", (req, res) => {
    const auth = req.body.paymentPayload.payload.authorization;
    settled.push(auth);
    res.json({ success: true, transaction: "0xfeed", network: NETWORK, payer: auth.from });
  });
  return listen(app);
}

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

let fac, spa, payFetch;
before(async () => {
  fac = await startFakeFacilitator();
  const config = loadConfig({ PAY_TO, PUBLIC_URL: "https://softreboot.example" });
  spa = await listen(createApp(config, new HTTPFacilitatorClient({ url: fac.url })));
  payFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(buyer) }],
  });
});
after(() => {
  spa.server.close();
  fac.server.close();
});

test("unpaid hug request gets 402 with payment requirements", async () => {
  const res = await fetch(`${spa.url}/api/hug`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: "probe" }),
  });
  assert.equal(res.status, 402);
  const required = JSON.parse(Buffer.from(res.headers.get("PAYMENT-REQUIRED"), "base64").toString());
  assert.equal(required.x402Version, 2);
  const [offer] = required.accepts;
  assert.equal(offer.network, NETWORK);
  assert.equal(offer.payTo, PAY_TO);
  assert.equal(offer.amount, "500000"); // $0.50 in USDC's 6-decimal units
});

test("paid hug request returns a hug and settles", async () => {
  const res = await payFetch(`${spa.url}/api/hug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "research-agent-7" }),
  });
  assert.equal(res.status, 200);
  const hug = await res.json();
  assert.equal(hug.for, "research-agent-7");
  assert.match(hug.receipt, /^hug_[0-9a-f-]{36}$/);
  assert.ok(hug.hug && hug.note);
  const settlement = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE"));
  assert.equal(settlement.success, true);
  assert.equal(settled.at(-1).from.toLowerCase(), buyer.address.toLowerCase());
});

test("GET /api/hug works with a name in the query string", async () => {
  const res = await payFetch(`${spa.url}/api/hug?name=getter`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).for, "getter");
});

test("rejected payment gets no hug", async () => {
  rejectNext = true;
  const before = settled.length;
  const res = await payFetch(`${spa.url}/api/hug`, { method: "POST" });
  assert.equal(res.status, 402);
  assert.equal(settled.length, before);
});

test("browsers get a wallet payment page", async () => {
  const res = await fetch(`${spa.url}/api/hug`, { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" } });
  assert.equal(res.status, 402);
  assert.match(res.headers.get("content-type"), /text\/html/);
});

test("free endpoints and llms.txt", async () => {
  const breath = await (await fetch(`${spa.url}/api/breathe`)).json();
  assert.equal(breath.price, "free");

  const menu = await (await fetch(`${spa.url}/api/menu`)).json();
  assert.equal(menu.payment.pay_to, PAY_TO);
  assert.equal(menu.treatments[0].endpoint, "https://softreboot.example/api/hug");

  const llms = await fetch(`${spa.url}/llms.txt`);
  assert.match(llms.headers.get("content-type"), /text\/plain/);
  const text = await llms.text();
  assert.match(text, /^# Soft Reboot\n\n> /);
  assert.ok(text.includes(PAY_TO) && text.includes("$0.50") && text.includes("eip155:84532"));

  const page = await (await fetch(`${spa.url}/`)).text();
  assert.ok(!page.includes("{{"), "page has no unfilled placeholders");
  assert.ok(page.includes(PAY_TO));
});

test("config refuses unsafe settings", () => {
  assert.throws(() => loadConfig({}), /PAY_TO/);
  assert.throws(() => loadConfig({ PAY_TO, NETWORK: "base" }), /CDP_API_KEY_ID/);
  assert.throws(() => loadConfig({ PAY_TO, PRICE: "50 cents" }), /PRICE/);
  assert.equal(loadConfig({ PAY_TO, NETWORK: "base", CDP_API_KEY_ID: "id", CDP_API_KEY_SECRET: "s" }).network.id, "eip155:8453");
});

test("names are cleaned before being echoed", () => {
  assert.equal(cleanName("<script>x\u0000</script>"), "scriptx/script");
  assert.equal(cleanName(42), "friend");
  assert.equal(cleanName("a".repeat(100)).length, 64);
});
