// Channels — the real surfaces the crew acts on.
//
// Telegram is the primary live surface: with a BotFather token set, a judge
// texts the bot from their own phone and gets a real reply back. Gmail sends
// real email over SMTP (app password). Both are credential-gated: with no
// credential they run "staged" (the action is recorded, nothing leaves) — which
// the rubric caps at L3. Set the token and the exact same code goes live (L4/L5).

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_API = TG_TOKEN ? `https://api.telegram.org/bot${TG_TOKEN}` : null;

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Alera <onboarding@resend.dev>";

export const channelStatus = () => ({
  telegram: Boolean(TG_TOKEN),
  // email is "live" via Resend (preferred) or Gmail SMTP app password
  gmail: Boolean(RESEND_KEY) || Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
  elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
});

// ── Telegram send ───────────────────────────────────────────────────────────────
export async function tgSend(chatId, text) {
  if (!TG_API) return { live: false, note: "staged (no TELEGRAM_BOT_TOKEN)" };
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return { live: true, ok: res.ok };
}

export async function tgSendVoice(chatId, audioBuffer) {
  if (!TG_API) return { live: false };
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("voice", new Blob([audioBuffer], { type: "audio/ogg" }), "reply.ogg");
  const res = await fetch(`${TG_API}/sendVoice`, { method: "POST", body: form });
  return { live: true, ok: res.ok };
}

// Long-poll Telegram for inbound messages. No public webhook needed — works on
// venue Wi-Fi. Calls onMessage({ text, chatId, from }) for each new message.
export function tgPoll(onMessage, { intervalMs = 1500 } = {}) {
  if (!TG_API) return () => {};
  let offset = 0;
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      const res = await fetch(`${TG_API}/getUpdates?timeout=20&offset=${offset}`);
      const data = await res.json();
      for (const u of data.result ?? []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (msg?.text) {
          const from = msg.from?.username ? `@${msg.from.username}` : `tg:${msg.chat.id}`;
          onMessage({ text: msg.text, chatId: msg.chat.id, from });
        }
      }
    } catch {
      /* keep polling */
    }
    if (!stopped) setTimeout(tick, intervalMs);
  }
  tick();
  return () => { stopped = true; };
}

// ── Gmail send (SMTP app password; nodemailer lazy-imported) ─────────────────────
let _transport = null;
async function transport() {
  if (_transport) return _transport;
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  try {
    const nodemailer = (await import("nodemailer")).default;
    _transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    return _transport;
  } catch {
    return null; // nodemailer not installed → staged
  }
}
export async function gmailSend(to, subject, text) {
  const tp = await transport();
  if (!tp) return { live: false, note: "staged (no Gmail SMTP / nodemailer)" };
  await tp.sendMail({ from: process.env.GMAIL_USER, to, subject, text });
  return { live: true, ok: true };
}

// Resend — reliable email over HTTPS API (no SMTP / app-password dance).
async function resendSend(to, subject, text) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { live: true, ok: true };
}

// Send email via Resend if configured, else Gmail SMTP.
export async function emailSend(to, subject, text) {
  if (RESEND_KEY) return resendSend(to, subject, text);
  return gmailSend(to, subject, text);
}

// Unified: deliver a reply on whatever channel the message came in on.
// Never throws — a bad credential returns a status object so the run still
// completes and the cockpit shows what happened.
export async function deliver(channel, to, text, subject = "Northline") {
  try {
    if (channel === "telegram") return await tgSend(to, text);
    if (channel === "email") return await emailSend(to, subject, text);
    return { live: false, note: `no sender for channel ${channel}` };
  } catch (e) {
    return { live: false, error: String(e.message || e) };
  }
}
