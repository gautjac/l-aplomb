import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.CLAUDE_API_KEY;
const client = new Anthropic({
  apiKey: apiKey ?? "",
  baseURL: "https://api.anthropic.com",
});

const MODEL = "claude-opus-4-8";

export interface CoachRequest {
  lang?: "fr" | "en";
  todayPct: number | null; // % upright today
  streak: number; // consecutive days meeting goal
  goalPct: number;
  nudges: number; // nudges today
  bestHoldMin: number; // best unbroken upright stretch today, minutes
  trend: number[]; // last 7 daily % (nulls dropped → numbers), oldest→newest
}

export interface CoachReply {
  reflection: string; // 2–3 warm sentences
  cue: string; // one tiny physical cue to try right now
}

function buildPrompt(r: CoachRequest, lang: "fr" | "en"): string {
  const trend = r.trend.length ? r.trend.join(", ") : "aucune donnée";
  if (lang === "en") {
    return `You are a calm, encouraging posture companion inside an app called L'Aplomb (a plumb line for the spine). The user works at a desk. Here are today's local, private stats:
- Upright today: ${r.todayPct ?? "n/a"}% (daily goal ${r.goalPct}%)
- Current streak: ${r.streak} day(s)
- Gentle nudges today: ${r.nudges}
- Longest unbroken upright stretch today: ${r.bestHoldMin} min
- Last 7 days upright %, oldest→newest: ${trend}

Write a SHORT, warm reflection (2–3 sentences) — never clinical, never shaming, honest about the data, quietly motivating. Then give ONE tiny physical cue they can do in 5 seconds right now. Avoid medical claims.`;
  }
  return `Tu es un compagnon de posture calme et encourageant dans une app québécoise nommée L'Aplomb (un fil à plomb pour la colonne). L'usager travaille au bureau. Voici ses statistiques locales et privées d'aujourd'hui :
- Droiture aujourd'hui : ${r.todayPct ?? "n/d"} % (objectif ${r.goalPct} %)
- Série en cours : ${r.streak} jour(s)
- Rappels doux aujourd'hui : ${r.nudges}
- Plus longue tenue droite d'affilée aujourd'hui : ${r.bestHoldMin} min
- Droiture des 7 derniers jours, du plus ancien au plus récent : ${trend}

Écris une réflexion COURTE et chaleureuse (2–3 phrases), en français québécois naturel — jamais clinique, jamais culpabilisante, honnête sur les chiffres, doucement motivante. Puis donne UN seul petit geste physique à faire en 5 secondes, tout de suite. Évite toute prétention médicale.`;
}

export async function coach(req: CoachRequest): Promise<CoachReply> {
  if (!apiKey) throw new Error("Server missing CLAUDE_API_KEY");
  const lang = req.lang === "en" ? "en" : "fr";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.8,
    tools: [
      {
        name: "render_reflection",
        description:
          lang === "en"
            ? "Return the posture reflection and one cue."
            : "Retourne la réflexion de posture et un geste.",
        input_schema: {
          type: "object",
          properties: {
            reflection: {
              type: "string",
              description:
                lang === "en"
                  ? "2–3 warm, honest sentences."
                  : "2–3 phrases chaleureuses et honnêtes.",
            },
            cue: {
              type: "string",
              description:
                lang === "en"
                  ? "One 5-second physical cue."
                  : "Un geste physique de 5 secondes.",
            },
          },
          required: ["reflection", "cue"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "render_reflection" },
    messages: [{ role: "user", content: buildPrompt(req, lang) }],
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("No structured reply");
  }
  const out = block.input as CoachReply;
  if (!out.reflection || !out.cue) throw new Error("Incomplete reply");
  return out;
}
