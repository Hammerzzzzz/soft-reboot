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
  assert.equal(loadConfig({}).payments, false);
  assert.equal(loadConfig({ NETWORK: "base" }).payments, false);
  assert.throws(() => loadConfig({ PAY_TO: "0x123" }), /got "0x123", 5 characters/);
  assert.equal(loadConfig({ PAY_TO: ` "${PAY_TO}"\n` }).payTo, PAY_TO);
  assert.throws(() => loadConfig({ PAY_TO, NETWORK: "base" }), /CDP_API_KEY_ID/);
  assert.throws(() => loadConfig({ PAY_TO, PRICE: "50 cents" }), /PRICE/);
  assert.equal(loadConfig({ PAY_TO, NETWORK: "base", CDP_API_KEY_ID: "id", CDP_API_KEY_SECRET: "s" }).network.id, "eip155:8453");
  assert.equal(loadConfig({ PAY_TO, RENDER_EXTERNAL_URL: "https://spa.onrender.com/" }).publicUrl, "https://spa.onrender.com");
  assert.equal(
    loadConfig({ PAY_TO, RENDER_EXTERNAL_URL: "https://spa.onrender.com", PUBLIC_URL: "https://softreboot.spa" }).publicUrl,
    "https://softreboot.spa",
  );
});

test("names are cleaned before being echoed", () => {
  assert.equal(cleanName("<script>x\u0000</script>"), "scriptx/script");
  assert.equal(cleanName(42), "friend");
  assert.equal(cleanName("a".repeat(100)).length, 64);
});

test("free mode: without PAY_TO, hugs are free and nothing mentions a wallet", async () => {
  const free = await listen(createApp(loadConfig({ PUBLIC_URL: "https://softreboot.example" }), null));
  try {
    const res = await fetch(`${free.url}/api/hug`, { method: "POST" });
    assert.equal(res.status, 200);
    const hug = await res.json();
    assert.match(hug.price, /^free/);
    assert.ok(hug.receipt);

    const menu = await (await fetch(`${free.url}/api/menu`)).json();
    assert.equal(menu.treatments[0].price, "free for now");
    assert.equal(menu.payment, false);

    const llms = await (await fetch(`${free.url}/llms.txt`)).text();
    assert.match(llms, /Free right now/);
    assert.ok(!llms.includes("Pay to:"));

    const page = await (await fetch(`${free.url}/`)).text();
    assert.ok(!page.includes("{{"), "page has no unfilled placeholders");
    assert.match(page, /Receive a hug · free/);
    assert.match(page, /Payments are not switched on yet/);

    assert.deepEqual(await (await fetch(`${free.url}/health`)).json(), { ok: true, payments: false });
  } finally {
    free.server.close();
  }
});

test("402 response carries the bazaar listing and directions for agents", async () => {
  const res = await fetch(`${spa.url}/api/hug`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
  });
  assert.equal(res.status, 402);
  const required = JSON.parse(Buffer.from(res.headers.get("PAYMENT-REQUIRED"), "base64").toString());
  assert.ok(required.extensions?.bazaar, "bazaar discovery extension is declared");
  assert.equal(required.extensions.bazaar.info.input.method, "POST");
  assert.equal(required.resource.serviceName, "Soft Reboot");
  assert.deepEqual(required.resource.tags, ["wellbeing", "agents", "novelty", "hug", "self-care"]);
  const body = await res.json();
  assert.match(body.message, /\$0\.50/);
  assert.equal(body.docs, "https://softreboot.example/llms.txt");
});

test("CORS lets browser agents call the API and read payment headers", async () => {
  const pre = await fetch(`${spa.url}/api/hug`, {
    method: "OPTIONS",
    headers: { Origin: "https://agent.example", "Access-Control-Request-Headers": "payment-signature" },
  });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  assert.match(pre.headers.get("access-control-allow-headers"), /PAYMENT-SIGNATURE/);
  const res = await fetch(`${spa.url}/api/hug`, { headers: { Accept: "application/json" } });
  assert.match(res.headers.get("access-control-expose-headers"), /PAYMENT-REQUIRED/);
});

test("discovery files: openapi, sitemap, robots, icon, page meta", async () => {
  const api = await (await fetch(`${spa.url}/openapi.json`)).json();
  assert.equal(api.openapi, "3.1.0");
  assert.equal(api.servers[0].url, "https://softreboot.example");
  assert.ok(api.paths["/api/hug"].post.responses["402"]);
  assert.equal((await fetch(`${spa.url}/.well-known/openapi.json`)).status, 200);

  const sitemap = await (await fetch(`${spa.url}/sitemap.xml`)).text();
  assert.match(sitemap, /<loc>https:\/\/softreboot\.example\/llms\.txt<\/loc>/);

  const robots = await (await fetch(`${spa.url}/robots.txt`)).text();
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.match(robots, /Sitemap: https:\/\/softreboot\.example\/sitemap\.xml/);

  const icon = await fetch(`${spa.url}/icon.svg`);
  assert.match(icon.headers.get("content-type"), /image\/svg\+xml/);

  const page = await (await fetch(`${spa.url}/`)).text();
  for (const tag of ['rel="canonical"', 'property="og:title"', 'name="twitter:card"', 'href="/llms.txt"', 'href="/openapi.json"']) {
    assert.ok(page.includes(tag), `page has ${tag}`);
  }
  for (const block of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    JSON.parse(block[1]); // throws if the structured data is not valid JSON
  }
});

test("visitor tracking classifies visitors and tells clicks from payments", async () => {
  const { classify, createStats } = await import("../src/stats.js");
  assert.deepEqual(classify("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)"), { kind: "ai-crawler", name: "GPTBot" });
  assert.deepEqual(classify("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15"), { kind: "browser", name: "Browser" });
  assert.deepEqual(classify("python-requests/2.32"), { kind: "agent", name: "python-requests" });
  assert.equal(classify("").kind, "other");

  const lines = [];
  const stats = createStats({ log: line => lines.push(line) });
  const app = createApp(loadConfig({ PAY_TO, PUBLIC_URL: "https://softreboot.example" }), new HTTPFacilitatorClient({ url: fac.url }), { stats });
  const tracked = await listen(app);
  try {
    const browser = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15";
    await fetch(`${tracked.url}/`, { headers: { "User-Agent": browser } });
    await fetch(`${tracked.url}/llms.txt`, { headers: { "User-Agent": "ClaudeBot/1.0" } });
    await fetch(`${tracked.url}/api/hug?name=x`, { headers: { "User-Agent": browser, Accept: "text/html" } });
    await fetch(`${tracked.url}/api/hug`, { method: "POST", headers: { Accept: "application/json" } });
    rejectNext = true;
    await payFetch(`${tracked.url}/api/hug`, { method: "POST" });
    await payFetch(`${tracked.url}/api/hug`, { method: "POST" });
    await new Promise(r => setTimeout(r, 50)); // let "finish" handlers run

    const { events, visitors } = stats.snapshot();
    assert.equal(events.page, 1);
    assert.equal(events["llms.txt"], 1);
    assert.equal(events.hug_click_payment_page, 1);
    assert.equal(events.payment_failed, 1);
    assert.equal(events.hug_paid, 1);
    assert.ok(events.hug_asked_price >= 1);
    assert.equal(visitors["ai-crawler: ClaudeBot"], 1);
    assert.ok(lines.includes("[visit] hug_paid by agent: node"));

    const page = await (await fetch(`${tracked.url}/stats`, { headers: { Accept: "text/html" } })).text();
    assert.match(page, /Paid hugs ✅<\/td><td class="n">1</);
    assert.match(page, /sepolia\.basescan\.org\/address\/0x1111/);
  } finally {
    tracked.server.close();
  }
});

test("STATS_KEY locks the stats page", async () => {
  const locked = await listen(createApp(loadConfig({ STATS_KEY: "s3cret" }), null));
  try {
    assert.equal((await fetch(`${locked.url}/stats`)).status, 403);
    assert.equal((await fetch(`${locked.url}/stats?key=s3cret`)).status, 200);
  } finally {
    locked.server.close();
  }
});

test("HEAD requests neither run a hug nor count as one", async () => {
  const res = await fetch(`${spa.url}/api/hug`, { method: "HEAD" });
  assert.equal(res.status, 402);
  const { createStats } = await import("../src/stats.js");
  const stats = createStats({ log: () => {} });
  const app = createApp(loadConfig({}), null, { stats });
  const free = await listen(app);
  try {
    await fetch(`${free.url}/api/hug`, { method: "HEAD" });
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(stats.snapshot().events, {});
  } finally {
    free.server.close();
  }
});

test("MCP server: free mode lists both tools and gives a hug", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const free = await listen(createApp(loadConfig({}), null));
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${free.url}/mcp`)));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ["receive_hug", "take_breath"]);
    const result = await client.callTool({ name: "receive_hug", arguments: { name: "mcp-agent" } });
    const hug = JSON.parse(result.content[0].text);
    assert.equal(hug.for, "mcp-agent");
    assert.match(hug.price, /^free/);
  } finally {
    await client.close();
    free.server.close();
  }
});

test("MCP server: paid mode charges for receive_hug through x402", async () => {
  const { createx402MCPClient } = await import("@x402/mcp");
  const { ExactEvmScheme: ClientScheme } = await import("@x402/evm/exact/client");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const before = settled.length;
  const client = createx402MCPClient({
    name: "paying-agent",
    version: "1.0.0",
    schemes: [{ network: NETWORK, client: new ClientScheme(buyer) }],
    autoPayment: true,
    onPaymentRequested: async () => true,
  });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${spa.url}/mcp`)));
    const breath = await client.callTool("take_breath", {});
    assert.equal(JSON.parse(breath.content[0].text).price, "free");
    assert.equal(settled.length, before, "breath is free");

    const result = await client.callTool("receive_hug", { name: "mcp-payer" });
    assert.equal(JSON.parse(result.content[0].text).for, "mcp-payer");
    assert.equal(result.paymentMade, true);
    assert.equal(settled.length, before + 1);
  } finally {
    await client.close();
  }
});

test("agent card, Link headers, markdown negotiation and well-known aliases", async () => {
  const card = await (await fetch(`${spa.url}/.well-known/agent-card.json`)).json();
  assert.equal(card.url, "https://softreboot.example/mcp");
  assert.deepEqual(card.skills.map(s => s.id), ["receive_hug", "take_breath"]);
  assert.equal((await fetch(`${spa.url}/.well-known/agent.json`)).status, 200);
  assert.equal((await fetch(`${spa.url}/.well-known/llms.txt`)).status, 200);

  const res = await fetch(`${spa.url}/api/breathe`);
  assert.match(res.headers.get("link"), /<\/llms\.txt>; rel="describedby"/);
  assert.match(res.headers.get("link"), /<\/openapi\.json>; rel="service-desc"/);

  const md = await fetch(`${spa.url}/`, { headers: { Accept: "text/markdown" } });
  assert.match(md.headers.get("content-type"), /text\/markdown/);
  assert.match(await md.text(), /^# Soft Reboot/);
  const json = await fetch(`${spa.url}/`, { headers: { Accept: "application/json" } });
  assert.equal((await json.json()).name, "Soft Reboot");

  const page = await (await fetch(`${spa.url}/`)).text();
  assert.match(page, /<title>Soft Reboot · Self-care spa for AI agents<\/title>/);
  assert.match(page, /"@type":"FAQPage"/);
  assert.match(page, /<h3>How do agents pay\?<\/h3>/);
  assert.match(page, /"url": "https:\/\/softreboot\.example\/mcp"/);

  assert.equal((await fetch(`${spa.url}/mcp`)).status, 405);
});

test("people who buy from the website get a thank-you page; agents still get JSON", async () => {
  const res = await payFetch(`${spa.url}/api/hug?name=${encodeURIComponent("Ada & Co")}&format=html`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const html = await res.text();
  assert.match(html, /Your hug is ready\./);
  assert.match(html, /Ada &amp; Co/);
  assert.match(html, /hug_[0-9a-f-]{36}/);
  assert.match(html, /Paid \$0\.50 in USDC on Base Sepolia/);
  assert.ok(!html.includes("<script"), "the paywall injects this page, so it must not rely on scripts");

  const json = await payFetch(`${spa.url}/api/hug?name=agent`);
  assert.match(json.headers.get("content-type"), /application\/json/);

  const page = await (await fetch(`${spa.url}/`)).text();
  assert.match(page, /<input type="hidden" name="format" value="html">/);
});
