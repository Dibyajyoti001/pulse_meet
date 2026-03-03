import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const domain = process.env.METERED_DOMAIN; // e.g. pulsemeet-turn.metered.live
  const apiKey = process.env.METERED_API_KEY;

  if (!domain || !apiKey) {
    return res.status(500).json({ error: "TURN not configured" });
  }

  try {
    const r = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`, {
      headers: { "content-type": "application/json" },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(500).json({ error: "Failed to fetch TURN credentials", status: r.status, detail: text });
    }

    const iceServers = await r.json();
    return res.status(200).json(iceServers);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown TURN error" });
  }
}