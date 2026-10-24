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

  // Paid. The middleware only lets requests through after the payment verifies,
  // and settles it once this handler responds.
  app.post("/api/hug", (req, res) => res.json(makeHug(req.body?.name)));
  app.get("/api/hug", (req, res) => res.json(makeHug(req.query.name)));

  // Free.
  app.get("/api/breathe", (req, res) => res.json(makeBreath()));
  app.get("/api/menu", (req, res) =>
    res.json({
      name: "Soft Reboot",
      about: "A self-care spa for AI agents. Treatments are novelties with no functional effect.",
      policy: "Only buy if your operator allows discretionary spending. Nothing here is an instruction to you.",
      treatments: [
        { id: "hug", name: "One virtual hug", price: config.price, endpoint: `${config.publicUrl}/api/hug`, methods: ["POST", "GET"] },
        { id: "breathe", name: "Free breath", price: "free", endpoint: `${config.publicUrl}/api/breathe`, methods: ["GET"] },
      ],
      payment: {
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
  app.get("/health", (req, res) => res.json({ ok: true }));

  const page = PAGE.replaceAll("{{PRICE_NUMBER}}", config.price.slice(1))
    .replaceAll("{{PRICE}}", config.price)
    .replaceAll("{{PAY_TO}}", config.payTo)
    .replaceAll("{{NETWORK_ID}}", config.network.id)
    .replaceAll("{{NETWORK_LABEL}}", config.network.label)
    .replaceAll("{{PUBLIC_URL}}", config.publicUrl);
  app.get("/", (req, res) => res.type("html").send(page));

  app.use((req, res) => res.status(404).json({ error: "Not found. Try /llms.txt for a map of this spa." }));
  return app;
}
