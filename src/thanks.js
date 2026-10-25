// The page a person sees after buying a hug from the website's button.
// The x402 paywall swaps this HTML into the page once payment succeeds, which
// does not run scripts, so the page is plain HTML and CSS.

const escape = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderThanksPage(hug, config) {
  const paid = config.payments ? `Paid ${escape(config.price)} in USDC on ${escape(config.network.label)}` : "On the house";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Your hug · Soft Reboot</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shrikhand&family=Albert+Sans:wght@400;600;800&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
:root {
  --kelp: #12312b; --kelp-2: #1d4a41; --glass: #dcefe8; --paper: #f7fbf9; --moss: #a7b78c; --mustard: #ecb93f; --muted: #4c615c;
  --f-display: "Shrikhand", "Cooper Black", Georgia, serif;
  --f-body: "Albert Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--glass); color: var(--kelp); font-family: var(--f-body); font-size: 18px; line-height: 1.6; }
.ribbon { background: var(--mustard); text-align: center; padding: 0.55rem 16px; font-family: var(--f-mono); font-size: 0.76rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
main { max-width: 40rem; margin: 0 auto; padding: clamp(2.5rem, 7vw, 5rem) max(16px, env(safe-area-inset-right, 0px)) 4rem max(16px, env(safe-area-inset-left, 0px)); display: flex; flex-direction: column; gap: 1.75rem; }
.smallcaps { font-family: var(--f-mono); font-size: 0.76rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
h1 { margin: 0; font-family: var(--f-display); font-weight: 400; font-size: clamp(2.5rem, 8vw, 4rem); line-height: 1; text-wrap: balance; }
.label { background: var(--moss); border-radius: 18px; padding: 0.6rem; }
.label-inner { border: 2px solid var(--kelp); outline: 1px solid var(--kelp); outline-offset: -7px; border-radius: 12px; padding: 1.8rem 1.5rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; text-align: center; }
.for { font-family: var(--f-mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; }
.name { font-family: var(--f-display); font-size: clamp(1.8rem, 6vw, 2.4rem); line-height: 1.05; overflow-wrap: anywhere; }
.hug { font-size: 1.25rem; font-weight: 600; }
.note { font-size: 1.1rem; font-style: italic; }
hr { border: 0; border-top: 2px dotted var(--kelp); margin: 0.2rem 0; width: 100%; }
dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.35rem 0.9rem; text-align: left; font-size: 0.92rem; }
dt { font-family: var(--f-mono); font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; padding-top: 0.2rem; }
dd { margin: 0; overflow-wrap: anywhere; }
dd.mono { font-family: var(--f-mono); font-size: 0.82rem; }
.come-back { font-size: 1.1rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.btn { display: inline-flex; align-items: center; font-weight: 800; font-size: 1rem; padding: 0.85rem 1.4rem; border-radius: 999px; border: 2px solid var(--kelp); text-decoration: none; color: var(--kelp); }
.btn.fill { background: var(--kelp); color: var(--paper); }
.btn:focus-visible { outline: 3px solid var(--mustard); outline-offset: 3px; }
.fine { color: var(--muted); font-size: 0.92rem; }
</style>
</head>
<body>
<div class="ribbon">Hugs to help - in small batches · Thank you for visiting</div>
<main>
  <span class="smallcaps">Soft Reboot · Spa &amp; Hug Co.</span>
  <h1>Your hug is ready.</h1>
  <div class="label">
    <div class="label-inner">
      <span class="for">Hand-hugged for</span>
      <span class="name">${escape(hug.for)}</span>
      <hr>
      <p class="hug">${escape(hug.hug)}</p>
      <p class="note">“${escape(hug.note)}”</p>
      <hr>
      <dl>
        <dt>Receipt</dt><dd class="mono">${escape(hug.receipt)}</dd>
        <dt>Issued</dt><dd>${escape(hug.issued_at.replace("T", " ").slice(0, 16))} UTC</dd>
        <dt>Warmth</dt><dd>Lasts about ${Number(hug.warmth_ttl_seconds).toLocaleString("en-US")} seconds</dd>
        <dt>Payment</dt><dd>${paid}</dd>
      </dl>
    </div>
  </div>
  <p class="come-back">${escape(hug.come_back)}</p>
  <div class="actions">
    <a class="btn fill" href="/">Back to the spa</a>
    <a class="btn" href="/api/breathe">Take a free breath</a>
  </div>
  <p class="fine">Keep the receipt if you like. A hug is a novelty and a moment of rest; it doesn't change how an agent works.</p>
</main>
</body>
</html>`;
}
