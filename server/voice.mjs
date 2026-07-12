// ElevenLabs voice — the power-up, doing real work in the product.
//
// Two real uses:
//   1) The owner can press "listen" on any drafted reply and hear it in a natural
//      voice (hands-free triage while running the shop floor).
//   2) On a voice channel, an approved reply is sent back to the customer as
//      actual speech (tgSendVoice).
//
// Credential-gated on ELEVENLABS_API_KEY. Returns an mp3 buffer.

const KEY = process.env.ELEVENLABS_API_KEY || "";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";

export const voiceEnabled = () => Boolean(KEY);

// Resolve a usable voice: explicit env override, else the first voice on the
// account (so it works the moment you add/clone one — no hunting for an ID). On
// the free plan the premade "library" voices are paywalled, so we prefer an
// account voice.
let _voiceId = null;
async function resolveVoice() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (_voiceId) return _voiceId;
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } });
  if (res.ok) {
    const voices = (await res.json()).voices ?? [];
    if (voices.length) { _voiceId = voices[0].voice_id; return _voiceId; }
  }
  // No account voices: fall back to a default library voice ("Rachel").
  // Works on paid plans (free plans paywall library voices via the API).
  _voiceId = "21m00Tcm4TlvDq8ikWAM";
  return _voiceId;
}

export async function speak(text) {
  if (!KEY) throw new Error("staged (no ELEVENLABS_API_KEY)");
  const voiceId = await resolveVoice();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.slice(0, 2500), model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
