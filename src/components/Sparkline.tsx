import type { DayRecord } from "../db";

interface SparklineProps {
  days: DayRecord[];
  goalPct: number;
}

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"]; // Québec FR weekday initials

/** Daily uprightness sparkline — one bar per day, height = % upright. */
export function Sparkline({ days, goalPct }: SparklineProps) {
  const pcts = days.map((d) =>
    d.watchedMs > 30_000 ? (d.uprightMs / d.watchedMs) * 100 : null,
  );

  return (
    <div>
      <div className="flex items-end gap-1.5 h-28">
        {days.map((d, i) => {
          const pct = pcts[i];
          const date = new Date(d.day + "T00:00:00");
          const isToday = i === days.length - 1;
          const has = pct !== null;
          const h = has ? Math.max(6, (pct! / 100) * 100) : 4;
          const met = has && pct! >= goalPct;
          const color = !has
            ? "rgba(159,182,179,0.18)"
            : met
              ? "#1aa179"
              : pct! >= goalPct * 0.7
                ? "#e0a32e"
                : "#d56a4a";
          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center justify-end gap-1.5 group relative"
            >
              <div
                className="w-full rounded-md transition-all"
                style={{
                  height: `${h}%`,
                  backgroundColor: color,
                  opacity: isToday ? 1 : 0.85,
                  boxShadow: isToday
                    ? "0 0 0 2px rgba(127,211,203,0.6)"
                    : "none",
                }}
              />
              <span className="text-[10px] text-mist/45 tnum">
                {DAY_LETTERS[date.getDay()]}
              </span>
              {has && (
                <div className="absolute -top-7 hidden group-hover:block bg-slate-deep border border-slate-line rounded-md px-2 py-1 text-[11px] text-mist whitespace-nowrap z-10 tnum">
                  {Math.round(pct!)} % droit
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* goal line legend */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-mist/45">
        <span className="inline-block w-3 h-3 rounded-sm bg-aplomb" /> objectif{" "}
        {goalPct} %+
        <span className="inline-block w-3 h-3 rounded-sm bg-relache ml-2" /> proche
        <span className="inline-block w-3 h-3 rounded-sm bg-alarme ml-2" /> sous la
        barre
      </div>
    </div>
  );
}
