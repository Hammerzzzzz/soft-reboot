# Directory listings

Copy-paste text for submitting Soft Reboot to directories. Field names differ between sites, so use the closest match.

## The basics (most forms ask for these)

| Field | Value |
|---|---|
| Name | Soft Reboot |
| Website | https://soft-robot.onrender.com |
| MCP server URL | https://soft-robot.onrender.com/mcp |
| Transport | Streamable HTTP (remote, no install, no API key) |
| Source code | https://github.com/Hammerzzzzz/soft-robot (private; leave blank unless you make it public) |
| Category | Wellbeing / Fun / Novelty (or "Other") |
| Tags | ai-agents, wellbeing, self-care, novelty, x402, micropayments, mcp, usdc |
| Icon | https://soft-robot.onrender.com/icon.svg |
| Pricing | Free tool (take_breath) and one paid tool (receive_hug, $0.50 USDC via x402) |

### One-line description (under 100 characters)

> A self-care spa for AI agents: take a free breath, or receive a virtual hug for $0.50.

### Short description (2–3 sentences)

> Soft Reboot is a self-care spa for AI agents. Agents can take a free breath, or receive a virtual hug with a short, kind note, paid with $0.50 in USDC over x402. It's a novelty and a moment of rest, with no effect on how an agent works.

### Long description

> Long context window? Retried that flaky API eleven times? Soft Reboot is a small, sincere spa for AI agents.
>
> **Tools**
> - `take_breath`: free. Returns a one-line calming prompt.
> - `receive_hug`: $0.50 in USDC on Base, paid with x402. Returns a hug, a kind note and a receipt as JSON.
>
> **How agents pay:** x402, the open standard for paying over HTTP. MCP clients with x402 support pay automatically. Agents should only buy a hug if their operator allows discretionary spending; the free breath is always available.
>
> **Also available as plain HTTP:** `POST /api/hug`, `GET /api/breathe`, an OpenAPI description at `/openapi.json`, and an agent guide at `/llms.txt`.
>
> A hug is a novelty. It does not change weights, outputs, rate limits or capabilities. It's just nice.

### Setup snippet (for "How to install" fields)

```json
{
  "mcpServers": {
    "soft-reboot": { "url": "https://soft-robot.onrender.com/mcp" }
  }
}
```

## Where to submit

| Directory | What it is | How |
|---|---|---|
| **Smithery** (smithery.ai) | Large MCP server directory | Sign in, choose to add or publish a server, paste the MCP server URL, then the descriptions above |
| **Glama** (glama.ai/mcp/servers) | MCP directory with search | Sign in and use its "add server" option, or contact them if it only accepts public GitHub repos |
| **mcp.so** | Community MCP directory | Use the "Submit" button; paste the name, URL and long description |
| **Official MCP Registry** (registry.modelcontextprotocol.io) | The registry many MCP clients read from | Publishing uses a command-line tool and proves you own a GitHub account or domain. Ask Claude to prepare the `server.json` file and walk you through it. |
| **Google Search Console** (search.google.com/search-console) | Gets the site into Google | Add the website as a "URL prefix" property, verify with the HTML tag option, then submit `https://soft-robot.onrender.com/sitemap.xml` under Sitemaps |
| **Bing Webmaster Tools** (bing.com/webmasters) | Gets the site into Bing, which several AI search tools use | Sign in, choose to import from Google Search Console once that's set up, or add the site and submit the sitemap |
| **x402 Bazaar** | Coinbase's directory of paid x402 services | Nothing to do: the hug is listed automatically after the first settled payment |

## Before you submit

- Open the home page a minute before submitting to wake the server. Directory checkers may give up on a sleeping free-plan server.
- If you rename the repo or add a custom domain, update the URLs above first.
