// Linkup — live web search doing real work in the crew (power-up).
//
// When the manager decides a message needs facts we don't hold (e.g. "do you
// ship to Canada and what are current customs rules", or researching a wholesale
// buyer's company before quoting), it emits a research query. We hit Linkup live,
// and the sourced answer is handed to the specialist so the reply is grounded in
// real, current web results instead of a guess.
//
// Credential-gated on LINKUP_API_KEY; returns { answer, sources }.

const KEY = process.env.LINKUP_API_KEY || "";

export const linkupEnabled = () => Boolean(KEY);

export async function linkupSearch(query) {
  if (!KEY) throw new Error("staged (no LINKUP_API_KEY)");
  const res = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, depth: "standard", outputType: "sourcedAnswer" }),
  });
  if (!res.ok) throw new Error(`linkup ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const sources = (data.sources ?? []).slice(0, 4).map((s) => ({ name: s.name ?? s.url, url: s.url, snippet: s.snippet ?? "" }));
  return { answer: data.answer ?? "", sources };
}
