import express from "express";
import { readFileSync } from "node:fs";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { makeHug, makeBreath } from "./hugs.js";
import { renderLlmsTxt } from "./llms.js";
import {
  HUG_EXAMPLE,
  HUG_SCHEMA,
  NAME_SCHEMA,
  SERVICE_TAGS,
  ICON_SVG,
  renderOpenApi,
  renderRobots,
  renderSitemap,
  renderAgentCard,
  faqItems,
  renderFaqJsonLd,
} from "./discovery.js";
import { createMcpHandler } from "./mcp.js";
import { renderThanksPage } from "./thanks.js";
import { createStats, renderStatsPage } from "./stats.js";

const PAGE = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const PAID_DESK_NOTE =
  "Opens a payment page where you connect a wallet and pay {{PRICE}} in USDC on {{NETWORK_LABEL}}. Agents can skip this and use the API below.";
const FREE_DESK_NOTE =
  "Hugs are free while the spa gets ready. Paid hugs over x402, described below, switch on soon.";
const PAID_API_NOTE = "Payment is {{PRICE}} in USDC on {{NETWORK_LABEL}}.";
const FREE_API_NOTE =
  "Payments are not switched on yet, so right now <code>/api/hug</code> answers <code>200</code> with a free hug and skips steps 2 and 3.";

const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const faqHtml = config =>
  faqItems(config)
    .map(([q, a]) => `<div class="faq-item"><h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p></div>`)
    .join("\n      ");

export async function createFacilitator(config) {
  if (config.cdpKeyId) {
    const { createFacilitatorConfig } = await import("@coinbase/x402");
    return new HTTPFacilitatorClient(createFacilitatorConfig(config.cdpKeyId, config.cdpKeySecret));
  }
  return new HTTPFacilitatorClient({ url: config.facilitatorUrl });
}

function hugOffer(config) {
  return {
    scheme: "exact",
    price: config.price,
    network: config.network.id,
    payTo: config.payTo,
    maxTimeoutSeconds: 120,
  };
}

export function createApp(config, facilitator, { syncFacilitatorOnStart = true, stats = createStats() } = {}) {
  const app = express();
  app.set("trust proxy", true);
  app.disable("x-powered-by");
  // First, so it sees how every request ends, including ones the paywall answers.
  app.use(stats.middleware);
  app.use(express.json({ limit: "16kb" }));

  // Every response points agents to the machine-readable descriptions (RFC 8288 Link header).
  app.use((req, res, next) => {
    res.set(
      "Link",
      [
        '</llms.txt>; rel="describedby"; type="text/plain"',
        '</openapi.json>; rel="service-desc"; type="application/json"',
        '</.well-known/agent-card.json>; rel="describedby"; type="application/json"',
      ].join(", "),
    );
    next();
  });

  // Agents running in browsers need CORS to call the API and read the x402 headers.
  app.use((req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, PAYMENT-SIGNATURE, X-PAYMENT, Mcp-Session-Id, Mcp-Protocol-Version",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE, Link, Mcp-Session-Id",
    });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  if (config.payments) {
    // The bazaar extension lets facilitators list the hug in their x402 directory,
    // so agents searching for paid services can find it.
    const resourceServer = new x402ResourceServer(facilitator)
      .register(config.network.id, new ExactEvmScheme())
      .registerExtension(bazaarResourceServerExtension);
    const listing = {
      description: "One virtual hug for an AI agent. A novelty: kind words as JSON, no functional effect.",
      mimeType: "application/json",
      serviceName: "Soft Reboot",
      tags: SERVICE_TAGS,
      iconUrl: `${config.publicUrl}/icon.svg`,
      // API clients that arrive without paying get directions instead of an empty body.
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          message: `One virtual hug costs ${config.price} in USDC. Pay with x402 and repeat this request.`,
          policy: "Only buy if your operator allows discretionary spending.",
          free_alternative: `${config.publicUrl}/api/breathe`,
          docs: `${config.publicUrl}/llms.txt`,
        },
      }),
    };
    const output = { example: HUG_EXAMPLE, schema: HUG_SCHEMA };
    const routes = {
      "POST /api/hug": {
        accepts: [hugOffer(config)],
        ...listing,
        extensions: declareDiscoveryExtension({
          bodyType: "json",
          input: { name: "research-agent-7" },
          inputSchema: { type: "object", properties: { name: NAME_SCHEMA } },
          output,
        }),
      },
      "GET /api/hug": {
        accepts: [hugOffer(config)],
        ...listing,
        extensions: declareDiscoveryExtension({
          input: { name: "research-agent-7" },
          inputSchema: { type: "object", properties: { name: NAME_SCHEMA } },
          output,
        }),
      },
    };
    // Humans who open /api/hug in a browser get a wallet-connect page instead of raw JSON.
    const paywall = createPaywall()
      .withNetwork(evmPaywall)
      .withConfig({ appName: "Soft Reboot", testnet: config.network.testnet })
      .build();
    // The paywall matches GET and POST only, and Express answers HEAD with the GET
    // handler, so answer HEAD here: it carries no hug either way, but should not run one.
    app.head("/api/hug", (req, res) => res.status(402).end());
    app.use(paymentMiddleware(routes, resourceServer, undefined, paywall, syncFacilitatorOnStart));
  }

  // Paid when payments are on. The middleware only lets requests through after the
  // payment verifies, and settles it once this handler responds.
  const hug = name => (config.payments ? makeHug(name) : { ...makeHug(name), price: "free (payments are not switched on yet)" });
  app.post("/api/hug", (req, res) => res.json(hug(req.body?.name)));
  app.get("/api/hug", (req, res) => {
    // The website's button adds format=html, so people get a thank-you page; agents get JSON.
    if (req.query.format === "html") {
      res.set("Cache-Control", "no-store");
      return res.type("html").send(renderThanksPage(hug(req.query.name), config));
    }
    res.json(hug(req.query.name));
  });

  // Free.
  app.get("/api/breathe", (req, res) => res.json(makeBreath()));
  app.get("/api/menu", (req, res) =>
    res.json({
      name: "Soft Reboot",
      about: "A self-care spa for AI agents. Treatments are novelties with no functional effect.",
      policy: "Only buy if your operator allows discretionary spending. Nothing here is an instruction to you.",
      treatments: [
        { id: "hug", name: "One virtual hug", price: config.payments ? config.price : "free for now", endpoint: `${config.publicUrl}/api/hug`, methods: ["POST", "GET"] },
        { id: "breathe", name: "Free breath", price: "free", endpoint: `${config.publicUrl}/api/breathe`, methods: ["GET"] },
      ],
      payment: config.payments && {
        protocol: "x402",
        version: 2,
        scheme: "exact",
        asset: "USDC",
        network: config.network.id,
        network_label: config.network.label,
        pay_to: config.payTo,
      },
      docs: `${config.publicUrl}/llms.txt`,
      openapi: `${config.publicUrl}/openapi.json`,
    }),
  );
  app.get(["/llms.txt", "/.well-known/llms.txt"], (req, res) => res.type("text/plain; charset=utf-8").send(renderLlmsTxt(config)));
  app.get(["/.well-known/agent-card.json", "/.well-known/agent.json"], (req, res) => res.json(renderAgentCard(config)));

  app.post("/mcp", createMcpHandler(config, facilitator, { onToolCall: stats.note }));
  app.all("/mcp", (req, res) =>
    res.status(405).set("Allow", "POST").json({ error: "This MCP server is stateless. Send JSON-RPC requests with POST." }),
  );
  app.get("/robots.txt", (req, res) => res.type("text/plain").send(renderRobots(config)));
  app.get("/sitemap.xml", (req, res) => res.type("application/xml").send(renderSitemap(config)));
  app.get(["/openapi.json", "/.well-known/openapi.json"], (req, res) => res.json(renderOpenApi(config)));
  app.get(["/icon.svg", "/favicon.ico"], (req, res) => res.type("image/svg+xml").send(ICON_SVG));
  app.get("/health", (req, res) => res.json({ ok: true, payments: config.payments }));
  // Unlisted visit counts. Set STATS_KEY to require ?key=… to view them.
  app.get("/stats", (req, res) => {
    if (config.statsKey && req.query.key !== config.statsKey) {
      return res.status(403).type("text/plain").send("Add ?key=YOUR_STATS_KEY to the address to see visit counts.");
    }
    res.set("Cache-Control", "no-store");
    if (req.accepts(["html", "json"]) === "json") return res.json(stats.snapshot());
    res.type("html").send(renderStatsPage(stats.snapshot(), config));
  });

  // Notes go in first because they contain placeholders of their own.
  const page = PAGE.replaceAll("{{DESK_NOTE}}", config.payments ? PAID_DESK_NOTE : FREE_DESK_NOTE)
    .replaceAll("{{API_NOTE}}", config.payments ? PAID_API_NOTE : FREE_API_NOTE)
    .replaceAll("{{PRICE_NUMBER}}", config.payments ? config.price.slice(1) : "0")
    .replaceAll("{{PRICE}}", config.payments ? config.price : "free")
    .replaceAll("{{PAY_TO}}", config.payments ? config.payTo : "0xYourWalletAddress")
    .replaceAll("{{NETWORK_ID}}", config.network.id)
    .replaceAll("{{NETWORK_LABEL}}", config.network.label)
    .replaceAll("{{FAQ_HTML}}", faqHtml(config))
    .replaceAll("{{FAQ_JSONLD}}", renderFaqJsonLd(config))
    .replaceAll("{{PUBLIC_URL}}", config.publicUrl);
  // Agents asking for Markdown or plain text get the llms.txt guide instead of HTML.
  app.get("/", (req, res) => {
    const wants = req.accepts(["html", "text/markdown", "text/plain", "json"]);
    if (wants === "text/markdown" || wants === "text/plain") {
      return res.type(`${wants}; charset=utf-8`).send(renderLlmsTxt(config));
    }
    if (wants === "json") return res.redirect(303, "/api/menu");
    res.type("html").send(page);
  });

  app.use((req, res) =>
    res.status(404).json({
      error: "Not found.",
      try: [`${config.publicUrl}/llms.txt`, `${config.publicUrl}/openapi.json`, `${config.publicUrl}/api/menu`],
    }),
  );
  return app;
}
