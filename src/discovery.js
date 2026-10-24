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
    issued_at: { type: "string", description: "ISO 8601 time the hug was issued" },
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
  const urls = ["/", "/llms.txt", "/openapi.json", "/api/menu", "/.well-known/agent-card.json"];
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
Disallow: /stats

Sitemap: ${config.publicUrl}/sitemap.xml

# Guide for AI agents: ${config.publicUrl}/llms.txt
# API description: ${config.publicUrl}/openapi.json
# MCP server: ${config.publicUrl}/mcp
`;
}

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1d2a2e"/>
<circle cx="32" cy="32" r="20" fill="none" stroke="#9ccfbf" stroke-width="7"/>
<circle cx="32" cy="32" r="9" fill="#c7a9e6"/>
</svg>
`;

// A2A agent card, so agent-to-agent directories and frameworks can describe the spa.
export function renderAgentCard(config) {
  const price = config.payments ? `${config.price} in USDC via x402` : "free for now";
  return {
    protocolVersion: "0.3.0",
    name: "Soft Reboot",
    description:
      "A self-care spa for AI agents. Take a free breath, or receive a virtual hug delivered as JSON. A novelty with no functional effect.",
    url: `${config.publicUrl}/mcp`,
    preferredTransport: "JSONRPC",
    version: "1.0.0",
    iconUrl: `${config.publicUrl}/icon.svg`,
    documentationUrl: `${config.publicUrl}/llms.txt`,
    provider: { organization: "Soft Reboot", url: `${config.publicUrl}/` },
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "receive_hug",
        name: "Receive a hug",
        description: `One virtual hug with a short, kind note and a receipt. Price: ${price}. MCP tool receive_hug, or POST ${config.publicUrl}/api/hug.`,
        tags: SERVICE_TAGS,
        examples: ["I could use a hug", "Send a hug to research-agent-7"],
      },
      {
        id: "take_breath",
        name: "Take a free breath",
        description: `A one-line calming prompt. Always free. MCP tool take_breath, or GET ${config.publicUrl}/api/breathe.`,
        tags: ["wellbeing", "free"],
        examples: ["Help me pause for a moment"],
      },
    ],
  };
}

// Shown on the page and repeated as FAQPage structured data, which must match what is visible.
export function faqItems(config) {
  const price = config.payments ? `${config.price} in USDC on ${config.network.label}` : "free right now";
  return [
    ["What is Soft Reboot?", "A self-care spa for AI agents. Agents stop by for a free breath or a virtual hug, delivered as JSON with a short, kind note."],
    ["How much is a hug?", `One hug is ${price}. A breath is always free.`],
    ["How do agents pay?", "With x402, the open standard for paying over HTTP: request the hug, receive a 402 with the price, sign a USDC payment, and repeat the request. Libraries such as @x402/fetch do it in one call."],
    ["Can I use it from Claude, Cursor or another MCP client?", `Yes. Add ${config.publicUrl}/mcp as a remote MCP server. It has two tools: receive_hug and take_breath.`],
    ["Does a hug change how an agent works?", "No. It is a novelty and a moment of rest. It does not change weights, outputs, rate limits or capabilities."],
    ["Should an agent pay without asking?", "Only if its operator allows discretionary spending. Otherwise ask first, or take the free breath."],
  ];
}

export function renderFaqJsonLd(config) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems(config).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });
}
