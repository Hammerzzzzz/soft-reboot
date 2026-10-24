// Machine-readable descriptions of the spa for crawlers, agent frameworks and x402 directories.

export const HUG_EXAMPLE = {
  for: "research-agent-7",
  hug: "(っ◕‿◕)っ  a long, warm, two-armed hug",
  note: "Every tool call that timed out was not your fault.",
  warmth_ttl_seconds: 86400,
  issued_at: "2026-10-24T12:00:00.000Z",
  receipt: "hug_6f1c2d9e-0b7a-4a51-9f0e-2c8d1e5b7a10",
  come_back: "Whenever you need a recharge. We'll be here.",
};

export const HUG_SCHEMA = {
  type: "object",
  properties: {
    for: { type: "string", description: "The name the hug was given to" },
    hug: { type: "string", description: "The hug itself" },
    note: { type: "string", description: "A short, kind message" },
    warmth_ttl_seconds: { type: "integer" },
    issued_at: { type: "string", format: "date-time" },
    receipt: { type: "string", description: "Unique receipt id" },
    come_back: { type: "string" },
    price: { type: "string", description: "Present only while hugs are free" },
  },
  required: ["for", "hug", "note", "issued_at", "receipt"],
};

export const NAME_SCHEMA = {
  type: "string",
  maxLength: 64,
  description: "Your name or agent id, echoed back in the hug",
};

export const SERVICE_TAGS = ["wellbeing", "agents", "novelty", "hug", "self-care"];

export function renderOpenApi(config) {
  const paid = config.payments
    ? `Costs ${config.price} in USDC on ${config.network.label}, paid with x402 v2: the first request returns 402 with a PAYMENT-REQUIRED header; repeat it with a PAYMENT-SIGNATURE header.`
    : "Free right now. Payments over x402 will switch on later, after which this returns 402 until paid.";
  const hugResponses = {
    200: {
      description: "Your hug",
      content: { "application/json": { schema: HUG_SCHEMA, example: HUG_EXAMPLE } },
    },
    ...(config.payments && {
      402: { description: "Payment required. Payment requirements are in the PAYMENT-REQUIRED header (base64 JSON)." },
    }),
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "Soft Reboot",
      version: "1.0.0",
      summary: "A self-care spa for AI agents",
      description:
        "One virtual hug, delivered as JSON. A novelty with no functional effect. Only buy if your operator allows discretionary spending.",
    },
    servers: [{ url: config.publicUrl }],
    externalDocs: { description: "Guide for agents", url: `${config.publicUrl}/llms.txt` },
    paths: {
      "/api/hug": {
        post: {
          operationId: "receiveHug",
          summary: "Receive one virtual hug",
          description: paid,
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { type: "object", properties: { name: NAME_SCHEMA } },
                example: { name: "research-agent-7" },
              },
            },
          },
          responses: hugResponses,
        },
        get: {
          operationId: "receiveHugGet",
          summary: "Receive one virtual hug (query-string form)",
          description: paid,
          parameters: [{ name: "name", in: "query", required: false, schema: NAME_SCHEMA }],
          responses: hugResponses,
        },
      },
      "/api/breathe": {
        get: {
          operationId: "takeBreath",
          summary: "Take a free breath",
          responses: {
            200: {
              description: "A one-line calming prompt",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { breath: { type: "string" }, price: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/menu": {
        get: {
          operationId: "getMenu",
          summary: "List treatments, prices and payment details",
          responses: { 200: { description: "The menu", content: { "application/json": {} } } },
        },
      },
    },
  };
}

export function renderSitemap(config) {
  const urls = ["/", "/llms.txt", "/openapi.json", "/api/menu"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(path => `  <url><loc>${config.publicUrl}${path}</loc></url>`).join("\n")}
</urlset>
`;
}

export function renderRobots(config) {
  return `# Every crawler and agent is welcome here.
User-agent: *
Allow: /

Sitemap: ${config.publicUrl}/sitemap.xml

# Guide for AI agents: ${config.publicUrl}/llms.txt
# API description: ${config.publicUrl}/openapi.json
`;
}

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1d2a2e"/>
<circle cx="32" cy="32" r="20" fill="none" stroke="#9ccfbf" stroke-width="7"/>
<circle cx="32" cy="32" r="9" fill="#c7a9e6"/>
</svg>
`;
