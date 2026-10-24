// Buys one hug, the way a visiting agent would.
// Usage: BUYER_PRIVATE_KEY=0x… npm run pay -- [url] [name]
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const url = process.argv[2] || "http://localhost:3000/api/hug";
const name = process.argv[3] || "test-agent";
const key = process.env.BUYER_PRIVATE_KEY;
if (!key) {
  console.error("Set BUYER_PRIVATE_KEY to a wallet holding USDC on the server's network.");
  process.exit(1);
}

const account = privateKeyToAccount(key);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPayment(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name }),
});
console.log(`HTTP ${res.status}`);
console.log(await res.text());
const settlement = res.headers.get("PAYMENT-RESPONSE");
if (settlement) console.log("Settlement:", decodePaymentResponseHeader(settlement));
