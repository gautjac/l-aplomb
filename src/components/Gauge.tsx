import type { PostureState } from "../useWatcher";
import { PlumbMark } from "./PlumbMark";

interface GaugeProps {
  state: PostureState;
  deviation: number;
  reason: string;
  faceSeen: boolean;
  hasBaseline: boolean;
}

const REASON_FR: Record<string, string> = {
  forward: "tête vers l'avant",
  "lean-in": "tu te rapproches de l'écran",
  drop: "tu t'affaisses",
  tilt: "tête inclinée",
  ok: "",
};

const STATE_LABEL: Record<PostureState, string> = {
  aplomb: "Aplomb",
  drift: "Léger relâchement",
  slouch: "Affaissement",
  absent: "En attente",
};

const STATE_TONE: Record<
  PostureState,
  "aplomb" | "relache" | "alarme" | "neutral"
> = {
  aplomb: "aplomb",
  drift: "relache",
  slouch: "alarme",
  absent: "neutral",
};

const RING: Record<PostureState, string> = {
  aplomb: "from-aplomb/30 to-teal-deep/10 border-aplomb/50",
  drift: "from-relache/25 to-teal-deep/10 border-relache/55",
  slouch: "from-alarme/30 to-teal-deep/10 border-alarme/60",
  absent: "from-slate-line/30 to-slate-deep/10 border-slate-line",
};

export function Gauge({
  state,
  deviation,
  reason,
  faceSeen,
  hasBaseline,
}: GaugeProps) {
  // map deviation (0 .. ~1.6) to a 0..100 collapse meter
  const collapse = Math.min(100, Math.round((deviation / 1.4) * 100));
  const tone = STATE_TONE[state];

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-b ${RING[state]} p-6 flex flex-col items-center text-center transition-colors duration-500`}
    >
      <PlumbMark
        size={62}
        tone={tone}
        swing={state === "slouch" || state === "drift"}
      />
      <div className="mt-3 text-2xl font-display tracking-tight">
        {hasBaseline ? STATE_LABEL[state] : "Non calibré"}
      </div>

      {!faceSeen && hasBaseline && (
        <p className="mt-1 text-xs text-mist/55">
          Je ne te vois pas — replace-toi devant la caméra.
        </p>
      )}
      {faceSeen && hasBaseline && reason && REASON_FR[reason] && (
        <p className="mt-1 text-xs text-mist/65">{REASON_FR[reason]}</p>
      )}
      {!hasBaseline && (
        <p className="mt-1 text-xs text-mist/55">
          Calibre ton aplomb pour activer la veille.
        </p>
      )}

      {/* deviation meter */}
      {hasBaseline && (
        <div className="mt-4 w-full max-w-[220px]">
          <div className="h-2 rounded-full bg-slate-deep/70 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(3, collapse)}%`,
                backgroundColor:
                  state === "aplomb"
                    ? "#1aa179"
                    : state === "drift"
                      ? "#e0a32e"
                      : "#d56a4a",
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-mist/40 tnum">
            <span>droit</span>
            <span>écart {collapse}%</span>
            <span>affaissé</span>
          </div>
        </div>
      )}
    </div>
  );
}
