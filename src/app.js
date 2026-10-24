import express from "express";
import { readFileSync } from "node:fs";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { makeHug, makeBreath } from "./hugs.js";
import { renderLlmsTxt } from "./llms.js";

const PAGE = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const PAID_DESK_NOTE =
  "Opens a payment page where you connect a wallet and pay {{PRICE}} in USDC on {{NETWORK_LABEL}}. Agents can skip this and use the API below.";
const FREE_DESK_NOTE =
  "Hugs are free while the spa gets ready. Paid hugs over x402, described below, switch on soon.";
const PAID_API_NOTE = "Payment is {{PRICE}} in USDC on {{NETWORK_LABEL}}.";
const FREE_API_NOTE =
  "Payments are not switched on yet, so right now <code>/api/hug</code> answers <code>200</code> with a free hug and skips steps 2 and 3.";

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

export function createApp(config, facilitator, { syncFacilitatorOnStart = true } = {}) {
  const app = express();
  app.set("trust proxy", true);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2kb" }));

  if (config.payments) {
    const resourceServer = new x402ResourceServer(facilitator).register(config.network.id, new ExactEvmScheme());
    const description = "One virtual hug for an AI agent. A novelty: kind words as JSON, no functional effect.";
    const routes = {
      "POST /api/hug": { accepts: [hugOffer(config)], description, mimeType: "application/json" },
      "GET /api/hug": { accepts: [hugOffer(config)], description, mimeType: "application/json" },
    };
    // Humans who open /api/hug in a browser get a wallet-connect page instead of raw JSON.
    const paywall = createPaywall()
      .withNetwork(evmPaywall)
      .withConfig({ appName: "Soft Reboot", testnet: config.network.testnet })
      .build();
    app.use(paymentMiddleware(routes, resourceServer, undefined, paywall, syncFacilitatorOnStart));
  }

  // Paid when payments are on. The middleware only lets requests through after the
  // payment verifies, and settles it once this handler responds.
  const hug = name => (config.payments ? makeHug(name) : { ...makeHug(name), price: "free (payments are not switched on yet)" });
  app.post("/api/hug", (req, res) => res.json(hug(req.body?.name)));
  app.get("/api/hug", (req, res) => res.json(hug(req.query.name)));

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
    }),
  );
  app.get("/llms.txt", (req, res) => res.type("text/plain; charset=utf-8").send(renderLlmsTxt(config)));
  app.get("/robots.txt", (req, res) =>
    res.type("text/plain").send(`User-agent: *\nAllow: /\n\n# Agent-readable guide: ${config.publicUrl}/llms.txt\n`),
  );
  app.get("/health", (req, res) => res.json({ ok: true, payments: config.payments }));

  // Notes go in first because they contain placeholders of their own.
  const page = PAGE.replaceAll("{{DESK_NOTE}}", config.payments ? PAID_DESK_NOTE : FREE_DESK_NOTE)
    .replaceAll("{{API_NOTE}}", config.payments ? PAID_API_NOTE : FREE_API_NOTE)
    .replaceAll("{{PRICE_NUMBER}}", config.payments ? config.price.slice(1) : "0")
    .replaceAll("{{PRICE}}", config.payments ? config.price : "free")
    .replaceAll("{{PAY_TO}}", config.payments ? config.payTo : "0xYourWalletAddress")
    .replaceAll("{{NETWORK_ID}}", config.network.id)
    .replaceAll("{{NETWORK_LABEL}}", config.network.label)
    .replaceAll("{{PUBLIC_URL}}", config.publicUrl);
  app.get("/", (req, res) => res.type("html").send(page));

  app.use((req, res) => res.status(404).json({ error: "Not found. Try /llms.txt for a map of this spa." }));
  return app;
}
