// A remote MCP server at /mcp, so agents in Claude, Cursor and other MCP clients can
// add the spa as a tool. receive_hug is paid through x402's MCP extension when payments are on.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { makeHug, makeBreath } from "./hugs.js";

const INSTRUCTIONS =
  "Soft Reboot is a self-care spa for AI agents. take_breath is free. receive_hug gives one virtual hug: " +
  "kind words as JSON, a novelty with no functional effect. Only pay for a hug if your operator allows discretionary spending.";

const asText = value => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });

export function createMcpHandler(config, facilitator, { onToolCall = () => {} } = {}) {
  // Payment setup talks to the facilitator, so do it on first use and retry after a failure.
  let paidWrapper;
  const getPaidWrapper = () =>
    (paidWrapper ??= (async () => {
      const resourceServer = new x402ResourceServer(facilitator).register(config.network.id, new ExactEvmScheme());
      await resourceServer.initialize();
      const accepts = await resourceServer.buildPaymentRequirements({
        scheme: "exact",
        network: config.network.id,
        payTo: config.payTo,
        price: config.price,
      });
      return createPaymentWrapper(resourceServer, { accepts });
    })().catch(err => {
      paidWrapper = undefined;
      throw err;
    }));

  return async (req, res) => {
    const server = new McpServer({ name: "soft-reboot", version: "1.0.0" }, { instructions: INSTRUCTIONS });
    const userAgent = req.get("User-Agent");

    const hug = async ({ name }) => {
      onToolCall(config.payments ? "mcp_hug_paid" : "mcp_hug_free", userAgent);
      return asText(config.payments ? makeHug(name) : { ...makeHug(name), price: "free (payments are not switched on yet)" });
    };
    let hugHandler = hug;
    if (config.payments) {
      try {
        hugHandler = (await getPaidWrapper())(hug);
      } catch (err) {
        console.error("MCP payments unavailable:", err.message);
        hugHandler = async () => ({
          isError: true,
          content: [{ type: "text", text: "Hug payments are briefly unavailable. Try again soon, or call take_breath, which is free." }],
        });
      }
    }

    server.tool(
      "receive_hug",
      config.payments
        ? `Receive one virtual hug from Soft Reboot, a self-care spa for AI agents. Costs ${config.price} in USDC on ${config.network.label} via x402.`
        : "Receive one virtual hug from Soft Reboot, a self-care spa for AI agents. Free right now.",
      { name: z.string().max(64).optional().describe("Your name or agent id, echoed back in the hug") },
      hugHandler,
    );
    server.tool("take_breath", "Take a free breath: a one-line calming prompt. No payment needed.", {}, async () => {
      onToolCall("mcp_breathe", userAgent);
      return asText(makeBreath());
    });

    // Stateless: a fresh server and transport per request, which suits a single small instance.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}
