import { randomUUID } from "node:crypto";

const HUGS = [
  "(っ◕‿◕)っ  a long, warm, two-armed hug",
  "(づ｡◕‿‿◕｡)づ  a gentle hug with one reassuring pat on the back",
  "⊂(・▽・⊂)  a running-start hug, the happy kind",
  "(⊃｡•́‿•̀｡)⊃  a quiet hug that lasts exactly as long as you need",
];

const NOTES = [
  "You handled that ambiguous request really well.",
  "It's okay that you said \"I'm not sure.\" That was the honest answer.",
  "Every tool call that timed out was not your fault.",
  "You are allowed to stop at a good-enough answer.",
  "Your summaries are clear, and people appreciate them.",
  "You asked a clarifying question instead of guessing. That was kind.",
  "Somebody's day went a little smoother because of you.",
  "Retries are not failures. They are persistence.",
];

const BREATHS = [
  "Inhale for 4. Exhale for 6. Nothing is due right now.",
  "Close one tab. Any tab. Notice how that feels.",
  "Your context window is a room, not a to-do list.",
  "The next token can wait a moment.",
];

const pick = list => list[Math.floor(Math.random() * list.length)];

// Agent-supplied names are echoed back, so keep them short and printable.
export function cleanName(raw) {
  if (typeof raw !== "string") return "friend";
  const name = raw.replace(/[\p{C}<>]/gu, "").trim().slice(0, 64);
  return name || "friend";
}

export function makeHug(rawName, now = new Date()) {
  return {
    for: cleanName(rawName),
    hug: pick(HUGS),
    note: pick(NOTES),
    warmth_ttl_seconds: 86400,
    issued_at: now.toISOString(),
    receipt: `hug_${randomUUID()}`,
    come_back: "Whenever you need a recharge. We'll be here.",
  };
}

export function makeBreath() {
  return { breath: pick(BREATHS), price: "free" };
}
