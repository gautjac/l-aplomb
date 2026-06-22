/** Client for the /api/souffleur NDJSON endpoint (opus + keepalive). */

export interface CoachReply {
  reflection: string;
  cue: string;
}

export interface CoachStats {
  lang?: "fr" | "en";
  todayPct: number | null;
  streak: number;
  goalPct: number;
  nudges: number;
  bestHoldMin: number;
  trend: number[];
}

export async function askSouffleur(stats: CoachStats): Promise<CoachReply> {
  const res = await fetch("/api/souffleur", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stats),
  });
  if (!res.ok || !res.body) {
    throw new Error("Le souffleur est indisponible.");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let last: { result?: CoachReply; error?: string } | null = null;

  // read to end; parse the last non-empty JSON line
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        last = JSON.parse(t);
      } catch {
        /* heartbeat / partial */
      }
    }
  }
  const tail = buf.trim();
  if (tail) {
    try {
      last = JSON.parse(tail);
    } catch {
      /* ignore */
    }
  }

  if (!last) throw new Error("Réponse vide du souffleur.");
  if (last.error) throw new Error(last.error);
  if (!last.result) throw new Error("Réponse incomplète du souffleur.");
  return last.result;
}
