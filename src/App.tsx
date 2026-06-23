import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSettings } from "./settings";
import { useWatcher } from "./useWatcher";
import {
  recentDays,
  computeStreak,
  todayKey,
  clearBaseline,
  MIN_SESSION_MS,
  type DayRecord,
} from "./db";
import { playChime, notify, nudgeLine, primeAudio } from "./nudge";
import { PlumbMark } from "./components/PlumbMark";
import { Gauge } from "./components/Gauge";
import { CameraPreview } from "./components/CameraPreview";
import { Sparkline } from "./components/Sparkline";
import { SettingsPanel } from "./components/SettingsPanel";
import { Onboarding } from "./components/Onboarding";
import { NudgeBanner } from "./components/NudgeBanner";
import { Souffleur } from "./components/Souffleur";
import type { CoachStats } from "./souffleur";

type SnoozeUntil = number | null;

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export default function App() {
  const [settings, update] = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(!settings.onboarded);
  const [nudgeMsg, setNudgeMsg] = useState<string | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<SnoozeUntil>(null);
  const [now, setNow] = useState(Date.now());
  const nudgeTimer = useRef<number | null>(null);

  // tick for snooze countdown
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const snoozeActive = snoozeUntil !== null && snoozeUntil > now;
  const quiet = settings.quietDuringCalls || snoozeActive;

  const onNudge = useCallback(() => {
    if (settings.nudgeSound) playChime();
    if (settings.nudgeNotification) notify();
    if (settings.nudgeVisual) {
      const msg = nudgeLine();
      setNudgeMsg(msg);
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => setNudgeMsg(null), 7000);
    }
  }, [settings.nudgeSound, settings.nudgeNotification, settings.nudgeVisual]);

  const watcher = useWatcher({
    sensitivity: settings.sensitivity,
    sustainSeconds: settings.sustainSeconds,
    quiet,
    onNudge,
  });
  const { status } = watcher;

  // live daily data
  const days = useLiveQuery<DayRecord[], DayRecord[]>(
    () => recentDays(14),
    [],
    [],
  );
  const today = useMemo(
    () => days?.find((d) => d.day === todayKey()),
    [days],
  );
  const streak = useMemo(
    () => (days ? computeStreak(days, settings.uprightGoalPct) : 0),
    [days, settings.uprightGoalPct],
  );
  const todayPct =
    today && today.watchedMs >= MIN_SESSION_MS
      ? Math.round((today.uprightMs / today.watchedMs) * 100)
      : null;

  const running = status.phase === "running" || status.phase === "calibrating";
  const hasBaseline = !!status.baseline;

  const coachStats = useMemo<CoachStats>(() => {
    const trend = (days ?? [])
      .slice(-7)
      .map((d) =>
        d.watchedMs >= MIN_SESSION_MS
          ? Math.round((d.uprightMs / d.watchedMs) * 100)
          : null,
      )
      .filter((n): n is number => n !== null);
    return {
      lang: "fr",
      todayPct,
      streak,
      goalPct: settings.uprightGoalPct,
      nudges: today?.nudges ?? 0,
      bestHoldMin: today ? Math.round(today.bestStreakMs / 60000) : 0,
      trend,
    };
  }, [days, todayPct, streak, settings.uprightGoalPct, today]);

  const finishOnboarding = () => {
    update({ onboarded: true });
    setShowOnboarding(false);
  };

  const handleStart = async () => {
    primeAudio(); // unlock audio inside the user gesture
    await watcher.start();
  };

  const handleStop = () => {
    watcher.stop();
    setSnoozeUntil(null);
  };

  // after camera is up but no baseline, auto-prompt calibration once
  const autoCalRef = useRef(false);
  useEffect(() => {
    if (
      status.phase === "running" &&
      !hasBaseline &&
      !autoCalRef.current
    ) {
      autoCalRef.current = true;
      // small delay so the video has frames
      const id = window.setTimeout(() => watcher.calibrate(), 900);
      return () => clearTimeout(id);
    }
    if (hasBaseline) autoCalRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.phase, hasBaseline]);

  const snooze = (minutes: number) =>
    setSnoozeUntil(Date.now() + minutes * 60000);

  const tone =
    status.state === "aplomb"
      ? "aplomb"
      : status.state === "drift"
        ? "relache"
        : status.state === "slouch"
          ? "alarme"
          : "neutral";

  return (
    <div className="min-h-full">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
      {nudgeMsg && (
        <NudgeBanner message={nudgeMsg} onDismiss={() => setNudgeMsg(null)} />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <PlumbMark size={44} tone={tone} swing={status.state === "slouch"} />
            <div>
              <h1 className="font-display text-2xl sm:text-3xl tracking-tight leading-none">
                L'Aplomb
              </h1>
              <p className="text-[11px] sm:text-xs text-mist/45 mt-1">
                le fil à plomb de ta colonne
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-teal-soft bg-teal-deep/30 border border-slate-line px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-aplomb" />
            100% sur l'appareil
          </div>
        </header>

        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5">
          {/* LEFT — camera + controls */}
          <section className="space-y-5">
            <CameraPreview
              videoRef={watcher.videoRef}
              detectorRef={watcher.detectorRef}
              mirror={settings.mirror}
              show={settings.showPreview && running}
              state={status.state}
            />

            {/* phase-dependent control bar */}
            <div className="panel rounded-2xl p-5 shadow-calm">
              {status.phase === "idle" && (
                <div className="text-center">
                  <p className="text-sm text-mist/70 mb-1">
                    Prêt à veiller sur ta posture ?
                  </p>
                  <p className="text-[11px] text-mist/45 mb-4">
                    Au démarrage, ton navigateur demandera l'accès à la caméra.
                    Rien n'est jamais envoyé.
                  </p>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="px-7 py-3 rounded-xl bg-teal hover:bg-teal-bright text-slate-deep font-semibold transition-colors shadow-calm"
                  >
                    Démarrer la veille
                  </button>
                </div>
              )}

              {(status.phase === "loading" ||
                status.phase === "requesting") && (
                <div className="text-center py-2">
                  <div className="flex justify-center mb-3">
                    <PlumbMark size={48} swing tone="neutral" />
                  </div>
                  <p className="text-sm text-mist/70">
                    {status.phase === "loading"
                      ? "Chargement du modèle sur l'appareil…"
                      : "En attente de ta permission caméra…"}
                  </p>
                </div>
              )}

              {status.phase === "error" && (
                <div className="text-center py-1">
                  <p className="text-sm text-alarme mb-3">{status.error}</p>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="px-5 py-2.5 rounded-xl border border-teal/50 text-teal-soft text-sm hover:bg-teal/10 transition-colors"
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {status.phase === "calibrating" && (
                <div className="text-center py-1">
                  <p className="font-display text-lg mb-1">
                    Tiens-toi droit, immobile…
                  </p>
                  <p className="text-[11px] text-mist/45 mb-3">
                    Je capture ton aplomb de référence.
                  </p>
                  <div className="h-2 rounded-full bg-slate-deep/70 overflow-hidden max-w-xs mx-auto">
                    <div
                      className="h-full bg-teal-bright transition-all duration-150"
                      style={{
                        width: `${Math.round(status.calibrationProgress * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {status.phase === "running" && (
                <div className="space-y-4">
                  {/* snooze / quiet row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-mist/45 mr-1">
                      Pause des rappels :
                    </span>
                    {[25, 50].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => snooze(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          snoozeActive
                            ? "border-slate-line text-mist/40"
                            : "border-teal/40 text-teal-soft hover:bg-teal/10"
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                    {snoozeActive && (
                      <button
                        type="button"
                        onClick={() => setSnoozeUntil(null)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-relache/50 text-relache hover:bg-relache/10 transition-colors tnum"
                      >
                        reprise dans{" "}
                        {Math.max(
                          0,
                          Math.ceil((snoozeUntil! - now) / 60000),
                        )}{" "}
                        min ✕
                      </button>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-sm text-mist/80">
                      Silence pendant les appels / rendus
                      <span className="block text-[11px] text-mist/45">
                        coupe les rappels sans arrêter la veille
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        update({ quietDuringCalls: !settings.quietDuringCalls })
                      }
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                        settings.quietDuringCalls ? "bg-relache" : "bg-slate-line"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-mist transition-transform ${
                          settings.quietDuringCalls ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </label>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => watcher.recalibrate()}
                      className="flex-1 py-2.5 rounded-xl border border-teal/40 text-teal-soft text-sm hover:bg-teal/10 transition-colors"
                    >
                      Recalibrer
                    </button>
                    <button
                      type="button"
                      onClick={handleStop}
                      className="flex-1 py-2.5 rounded-xl border border-slate-line text-mist/60 text-sm hover:bg-slate-line/40 transition-colors"
                    >
                      Arrêter
                    </button>
                  </div>

                  <p className="text-center text-[10px] text-mist/30 tnum">
                    {status.detectorKind === "pose"
                      ? "épaules + tête"
                      : "visage"}{" "}
                    · {status.fps} i/s · {quiet ? "rappels en pause" : "veille active"}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT — gauge + stats + settings */}
          <section className="space-y-5">
            <Gauge
              state={status.state}
              deviation={status.deviation}
              reason={status.reason}
              faceSeen={status.faceSeen}
              hasBaseline={hasBaseline}
            />

            {/* today + streak */}
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Aujourd'hui"
                value={todayPct !== null ? `${todayPct}%` : "—"}
                hint="droit"
              />
              <Stat
                label="Série"
                value={`${streak}`}
                hint={streak > 1 ? "jours" : "jour"}
                accent
              />
              <Stat
                label="Meilleure tenue"
                value={today ? fmtDuration(today.bestStreakMs) : "—"}
                hint="d'affilée"
              />
            </div>

            {/* sparkline */}
            <div className="panel rounded-2xl p-5 shadow-calm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg">Ta droiture · 14 jours</h3>
                {today && today.nudges > 0 && (
                  <span className="text-[11px] text-mist/45 tnum">
                    {today.nudges} rappel{today.nudges > 1 ? "s" : ""} aujourd'hui
                  </span>
                )}
              </div>
              {days && days.length > 0 ? (
                <Sparkline days={days} goalPct={settings.uprightGoalPct} />
              ) : (
                <p className="text-sm text-mist/45 py-6 text-center">
                  Tes journées de veille apparaîtront ici.
                </p>
              )}
            </div>

            <Souffleur stats={coachStats} enabled={todayPct !== null} />

            <SettingsPanel
              settings={settings}
              update={update}
              onRecalibrate={() => {
                if (running) watcher.recalibrate();
              }}
              canRecalibrate={running}
            />

            {/* privacy reassurance */}
            <div className="rounded-2xl border border-slate-line bg-slate-deep/40 p-4 text-[12px] text-mist/55 leading-relaxed flex gap-3">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0 mt-0.5 text-teal-soft"
              >
                <path
                  d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p>
                <strong className="text-mist/80">Confidentialité totale.</strong>{" "}
                L'image de ta caméra est analysée uniquement dans ce navigateur,
                sur ta machine. Rien n'est enregistré, rien n'est téléversé, aucun
                serveur ne voit ton visage. Seules des statistiques chiffrées
                (pourcentages de droiture) restent localement.{" "}
                <button
                  type="button"
                  onClick={async () => {
                    await clearBaseline();
                    if (running) watcher.recalibrate();
                  }}
                  className="underline decoration-dotted hover:text-mist/80"
                >
                  Effacer ma calibration
                </button>
              </p>
            </div>
          </section>
        </div>

        <footer className="mt-10 text-center text-[11px] text-mist/30">
          L'Aplomb · veilleur de posture local · l'analyse de posture est une
          heuristique, pas un diagnostic médical
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="panel rounded-2xl p-4 text-center shadow-calm">
      <div className="text-[10px] uppercase tracking-wider text-mist/40 mb-1">
        {label}
      </div>
      <div
        className={`font-display text-2xl tnum leading-none ${
          accent ? "text-teal-bright" : "text-mist"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-mist/40 mt-1">{hint}</div>
    </div>
  );
}
