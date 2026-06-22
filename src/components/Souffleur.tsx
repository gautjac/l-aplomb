import { useState } from "react";
import { askSouffleur, type CoachReply, type CoachStats } from "../souffleur";

interface SouffleurProps {
  stats: CoachStats;
  enabled: boolean;
}

/**
 * "Le Souffleur" — an optional, on-demand warm reflection from Claude on your
 * day's posture. Stats are computed locally; only the numbers (never any image)
 * are sent to generate the note.
 */
export function Souffleur({ stats, enabled }: SouffleurProps) {
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ask = async () => {
    setLoading(true);
    setErr(null);
    try {
      setReply(await askSouffleur(stats));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel rounded-2xl p-5 shadow-calm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-lg">Le Souffleur</h3>
        <span className="text-[10px] text-mist/35">facultatif · Claude</span>
      </div>
      <p className="text-[11px] text-mist/45 mb-3">
        Un mot doux sur ta journée. Seuls tes chiffres de droiture sont envoyés —
        jamais ton image.
      </p>

      {reply && (
        <div className="rounded-xl bg-slate-deep/40 border border-slate-line p-4 mb-3 animate-riseIn">
          <p className="text-[14px] text-mist/85 leading-relaxed">
            {reply.reflection}
          </p>
          <div className="mt-3 flex items-start gap-2">
            <span className="text-teal-soft text-sm mt-0.5">↳</span>
            <p className="text-[13px] text-teal-soft leading-snug">{reply.cue}</p>
          </div>
        </div>
      )}

      {err && <p className="text-xs text-alarme mb-3">{err}</p>}

      <button
        type="button"
        onClick={ask}
        disabled={loading || !enabled}
        className="w-full py-2.5 rounded-xl border border-teal/40 text-teal-soft text-sm hover:bg-teal/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? "Le souffleur réfléchit…"
          : !enabled
            ? "Commence une journée pour recevoir un mot"
            : reply
              ? "Un autre mot"
              : "Demander un mot au souffleur"}
      </button>
    </div>
  );
}
