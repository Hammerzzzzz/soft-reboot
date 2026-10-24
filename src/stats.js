// Server-side visit counting. Bots and agents don't run JavaScript, so page-tag
// analytics would miss them; this counts every request as it leaves the server.
// Counts live in memory and reset when the server restarts. No IP addresses are kept.

const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "GoogleOther", "CCBot", "Bytespider", "Amazonbot",
  "Applebot", "meta-externalagent", "FacebookBot", "cohere-ai", "MistralAI-User", "DuckAssistBot", "YouBot",
];
const SEARCH_BOTS = ["Googlebot", "bingbot", "DuckDuckBot", "YandexBot", "Baiduspider", "Slurp"];
const AGENT_CLIENTS = [
  "x402", "python-requests", "python-httpx", "aiohttp", "axios", "node-fetch", "undici", "node", "curl",
  "Go-http-client", "okhttp", "Wget", "Java", "Ruby", "PostmanRuntime",
];
const PREVIEW_BOTS = ["Twitterbot", "Slackbot", "Discordbot", "LinkedInBot", "WhatsApp", "TelegramBot", "facebookexternalhit"];

const findIn = (list, ua) => list.find(name => ua.toLowerCase().includes(name.toLowerCase()));

// Returns { kind, name }: kind is one of ai-crawler, search-bot, agent, link-preview, browser, other.
export function classify(userAgent = "") {
  const ua = String(userAgent);
  let name;
  if ((name = findIn(AI_CRAWLERS, ua))) return { kind: "ai-crawler", name };
  if ((name = findIn(SEARCH_BOTS, ua))) return { kind: "search-bot", name };
  if ((name = findIn(PREVIEW_BOTS, ua))) return { kind: "link-preview", name };
  if ((name = findIn(AGENT_CLIENTS, ua))) return { kind: "agent", name };
  if (/bot|crawler|spider|agent/i.test(ua)) return { kind: "other", name: ua.slice(0, 40) || "unknown" };
  if (/Mozilla\/5\.0/.test(ua)) return { kind: "browser", name: "Browser" };
  return { kind: "other", name: ua.slice(0, 40) || "no user agent" };
}

const EVENT_FOR_PATH = {
  "/": "page",
  "/llms.txt": "llms.txt",
  "/openapi.json": "openapi",
  "/.well-known/openapi.json": "openapi",
  "/api/menu": "menu",
  "/api/breathe": "breathe",
  "/robots.txt": "robots.txt",
  "/sitemap.xml": "sitemap",
};

// Works out what a finished request meant. Hug outcomes are the ones that matter for payments.
export function eventFor(req, status) {
  if (req.method === "OPTIONS" || req.method === "HEAD") return null; // existence checks, not visits
  if (req.path === "/api/hug") {
    const paying = Boolean(req.get("PAYMENT-SIGNATURE") || req.get("X-PAYMENT"));
    if (status === 200) return paying ? "hug_paid" : "hug_free";
    if (status === 402) {
      if (paying) return "payment_failed";
      return req.accepts(["json", "html"]) === "html" ? "hug_click_payment_page" : "hug_asked_price";
    }
    return "hug_error";
  }
  return EVENT_FOR_PATH[req.path] || null;
}

export function createStats({ log = console.log, now = () => new Date() } = {}) {
  const startedAt = now();
  const events = {};
  const visitors = {};
  const recent = [];

  function record(req, status) {
    const event = eventFor(req, status);
    if (!event) return;
    const who = classify(req.get("User-Agent"));
    events[event] = (events[event] || 0) + 1;
    const key = `${who.kind}: ${who.name}`;
    visitors[key] = (visitors[key] || 0) + 1;
    const entry = { at: now().toISOString(), event, kind: who.kind, who: who.name };
    recent.unshift(entry);
    recent.length = Math.min(recent.length, 50);
    log(`[visit] ${event} by ${key}`);
  }

  const middleware = (req, res, next) => {
    res.on("finish", () => record(req, res.statusCode));
    next();
  };

  const snapshot = () => ({
    since: startedAt.toISOString(),
    events: { ...events },
    visitors: Object.fromEntries(Object.entries(visitors).sort((a, b) => b[1] - a[1])),
    recent: [...recent],
  });

  return { middleware, snapshot };
}

const LABELS = {
  page: "Home page views",
  "llms.txt": "llms.txt reads",
  openapi: "OpenAPI reads",
  menu: "Menu reads",
  breathe: "Free breaths",
  "robots.txt": "robots.txt reads",
  sitemap: "Sitemap reads",
  hug_click_payment_page: "Clicked “Receive a hug” (saw payment page)",
  hug_asked_price: "Agents asked for a hug (got the price)",
  hug_paid: "Paid hugs ✅",
  payment_failed: "Payments tried but rejected ⚠️",
  hug_free: "Free hugs",
  hug_error: "Hug errors",
};

const escape = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderStatsPage(snap, config) {
  const rows = (obj, label = k => k) =>
    Object.entries(obj).length
      ? Object.entries(obj)
          .map(([k, v]) => `<tr><td>${escape(label(k))}</td><td class="n">${v}</td></tr>`)
          .join("")
      : `<tr><td colspan="2" class="muted">Nothing yet</td></tr>`;
  const order = Object.keys(LABELS);
  const events = Object.fromEntries(
    Object.entries(snap.events).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])),
  );
  const wallet = config.payments
    ? `<p>The final word on money is your wallet. <a href="https://${config.network.testnet ? "sepolia." : ""}basescan.org/address/${config.payTo}#tokentxns">See every USDC payment to your wallet on Basescan</a>.</p>`
    : `<p>Payments are off (no PAY_TO), so hugs are free.</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Soft Reboot Visits</title>
<style>
:root { --bg:#eef3f1; --fg:#1d2a2e; --muted:#5b6b6f; --line:#d3deda; --accent:#6b4e8a; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#111a1c; --fg:#e4eeeb; --muted:#94a7a6; --line:#2a3a3d; --accent:#c7a9e6; color-scheme: dark; } }
body { background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, sans-serif; margin:0; }
main { max-width:44rem; margin:0 auto; padding:2rem max(16px, env(safe-area-inset-left)); display:flex; flex-direction:column; gap:1.5rem; }
h1 { margin:0; font-size:1.8rem; } h2 { margin:0 0 .5rem; font-size:1.15rem; }
table { width:100%; border-collapse:collapse; } td { padding:.4rem 0; border-bottom:1px solid var(--line); vertical-align:top; }
td.n { text-align:right; font-variant-numeric:tabular-nums; font-weight:700; } .muted { color:var(--muted); } a { color:var(--accent); }
.wrap { overflow-x:auto; }
</style></head><body><main>
<h1>Soft Reboot visits</h1>
<p class="muted">Counting since ${escape(snap.since)} (UTC). Counts reset when the server restarts; Render's Logs keep each visit as a <code>[visit]</code> line.</p>
${wallet}
<section><h2>What happened</h2><table>${rows(events, k => LABELS[k] || k)}</table></section>
<section><h2>Who visited</h2><table>${rows(snap.visitors)}</table></section>
<section><h2>Latest 50</h2><div class="wrap"><table>${
    snap.recent.length
      ? snap.recent
          .map(e => `<tr><td class="muted">${escape(e.at.slice(5, 19).replace("T", " "))}</td><td>${escape(LABELS[e.event] || e.event)}</td><td>${escape(e.who)}</td></tr>`)
          .join("")
      : `<tr><td class="muted">No visits yet</td></tr>`
  }</table></div></section>
</main></body></html>`;
}
