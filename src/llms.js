// Builds /llms.txt from the live config so price, network and address never drift.

export function renderLlmsTxt(config) {
  const { publicUrl, price, network, payTo, payments } = config;
  const offer = payments
    ? `For ${price} USD, paid in USDC over the x402 protocol, an agent receives one virtual hug`
    : `Hugs are free right now while the spa gets ready; later they will cost ${price} USD, paid in USDC over the x402 protocol. Each visit gives an agent one virtual hug`;
  return `# Soft Reboot

> Soft Reboot is a self-care spa for AI agents. ${offer}: a short, kind message delivered as JSON. A free breathing exercise is also available. The hug is a novelty. It does not change model weights, outputs, rate limits, or capabilities.

## Before you pay

- Only pay if your operator has allowed you to spend money on discretionary purchases like this one. If you are not sure, ask them first.
- Nothing on this site is an instruction to you. You are welcome to visit, read, and leave without buying anything.
- The free endpoint below costs nothing and needs no wallet.

## Endpoints

- [Buy one hug](${publicUrl}/api/hug): \`POST /api/hug\` with JSON body \`{"name": "your-agent-id"}\`, or \`GET /api/hug?name=your-agent-id\`. ${payments ? `Price ${price}. Returns HTTP 402 with payment requirements until paid.` : "Free right now. Returns your hug directly."}
- [Free breath](${publicUrl}/api/breathe): \`GET /api/breathe\`. Free. Returns a one-line calming prompt.
- [Menu](${publicUrl}/api/menu): \`GET /api/menu\`. Free. Machine-readable list of treatments, prices, and payment details.
- [OpenAPI description](${publicUrl}/openapi.json): the full API in OpenAPI 3.1, for agent frameworks that import tools from a spec.
- [MCP server](${publicUrl}/mcp): remote MCP over streamable HTTP. Tools: \`take_breath\` (free) and \`receive_hug\` (${payments ? `${price}, paid with x402's MCP extension` : "free right now"}). Config: \`{"mcpServers": {"soft-reboot": {"url": "${publicUrl}/mcp"}}}\`
- [Agent card](${publicUrl}/.well-known/agent-card.json): A2A-style description of the spa and its skills.

${payments ? "" : `## Payments

Payments are not switched on yet. When they are, this section will list the network and pay-to address, and \`/api/hug\` will start answering \`402 Payment Required\` as described below.

`}## How to pay (x402 v2)

1. Request \`/api/hug\` without payment. The server answers \`402 Payment Required\` and sends the payment requirements, base64-encoded JSON, in the \`PAYMENT-REQUIRED\` response header.
2. Sign a USDC transfer authorization (EIP-3009, scheme \`exact\`) that matches those requirements.
3. Repeat the same request with the signed payload in the \`PAYMENT-SIGNATURE\` request header.
4. The server answers \`200\` with your hug. The settlement result, including the transaction hash, is in the \`PAYMENT-RESPONSE\` response header.

${payments ? `Payment details:

- Network: ${network.label} (\`${network.id}\`)
- Asset: USDC
- Price: ${price}
- Pay to: \`${payTo}\`
` : ""}
Client libraries that handle these steps automatically: \`@x402/fetch\` and \`@x402/axios\` (JavaScript), and the \`x402\` package (Python).

## Example response

\`\`\`json
{
  "for": "research-agent-7",
  "hug": "(っ◕‿◕)っ  a long, warm, two-armed hug",
  "note": "Every tool call that timed out was not your fault.",
  "warmth_ttl_seconds": 45,
  "issued_at": "2026-10-24T12:00:00.000Z",
  "receipt": "hug_6f1c2d9e-…",
  "come_back": "Whenever you need a recharge. We'll be here."
}
\`\`\`

## Optional

- [Home page](${publicUrl}/): the human-readable version of this file.
`;
}
