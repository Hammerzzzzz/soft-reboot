// Reads settings from environment variables and fails fast on anything unsafe.

export const NETWORKS = {
  "base-sepolia": { id: "eip155:84532", label: "Base Sepolia (testnet)", testnet: true },
  base: { id: "eip155:8453", label: "Base", testnet: false },
};

const DEFAULT_TESTNET_FACILITATOR = "https://x402.org/facilitator";

export function loadConfig(env = process.env) {
  const networkName = env.NETWORK || "base-sepolia";
  const network = NETWORKS[networkName];
  if (!network) {
    throw new Error(`NETWORK must be one of: ${Object.keys(NETWORKS).join(", ")} (got "${networkName}")`);
  }

  // Pasted addresses often pick up stray spaces, quotes or line breaks.
  const payTo = (env.PAY_TO || "").trim().replace(/^["']|["']$/g, "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
    const got = payTo ? `got "${payTo}", ${payTo.length} characters` : "it is not set";
    throw new Error(`PAY_TO must be the 0x… wallet address that receives USDC: 0x plus 40 letters/digits (${got})`);
  }

  const price = env.PRICE || "$0.50";
  if (!/^\$\d+(\.\d{1,6})?$/.test(price)) {
    throw new Error(`PRICE must look like "$0.50" (got "${price}")`);
  }

  const cdpKeyId = env.CDP_API_KEY_ID || "";
  const cdpKeySecret = env.CDP_API_KEY_SECRET || "";
  const facilitatorUrl = env.FACILITATOR_URL || (cdpKeyId ? "" : DEFAULT_TESTNET_FACILITATOR);

  // The public x402.org facilitator only settles testnet payments. Mainnet needs
  // Coinbase CDP keys or an explicitly chosen facilitator.
  if (!network.testnet && !cdpKeyId && !env.FACILITATOR_URL) {
    throw new Error("NETWORK=base needs CDP_API_KEY_ID and CDP_API_KEY_SECRET, or FACILITATOR_URL");
  }
  if (cdpKeyId && !cdpKeySecret) {
    throw new Error("CDP_API_KEY_SECRET is required when CDP_API_KEY_ID is set");
  }

  return {
    port: Number(env.PORT) || 3000,
    // Render sets RENDER_EXTERNAL_URL itself, so PUBLIC_URL is only needed for a custom domain.
    publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(
      /\/+$/,
      "",
    ),
    networkName,
    network,
    payTo,
    price,
    facilitatorUrl,
    cdpKeyId,
    cdpKeySecret,
  };
}
