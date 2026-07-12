// Test the active email path (Resend if RESEND_API_KEY set, else Gmail SMTP).
import { emailSend, channelStatus } from "./channels.mjs";

const to = process.env.TEST_TO || process.env.GMAIL_USER || "delivered@resend.dev";
console.log("email live:", channelStatus().gmail, "| sending to:", to);
try {
  const r = await emailSend(to, "Alera email test", "If you see this, Alera email delivery works.");
  console.log("SENT:", r);
} catch (e) {
  console.log("ERROR:", e.message);
}
