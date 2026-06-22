import type { Settings } from "../settings";
import { ensureNotificationPermission } from "../nudge";

interface SettingsPanelProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onRecalibrate: () => void;
  canRecalibrate: boolean;
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 py-2.5 text-left group"
    >
      <span>
        <span className="text-sm text-mist">{label}</span>
        {hint && <span className="block text-[11px] text-mist/45">{hint}</span>}
      </span>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-teal" : "bg-slate-line"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-mist transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function SettingsPanel({
  settings,
  update,
  onRecalibrate,
  canRecalibrate,
}: SettingsPanelProps) {
  return (
    <div className="panel rounded-2xl p-5 shadow-calm">
      <h3 className="font-display text-lg mb-1">Réglages</h3>
      <p className="text-[11px] text-mist/45 mb-4">
        Tout reste sur cette machine.
      </p>

      {/* sensitivity */}
      <label className="block mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-mist/80">Sensibilité</span>
          <span className="text-teal-soft tnum">
            {Math.round(settings.sensitivity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.sensitivity}
          onChange={(e) => update({ sensitivity: Number(e.target.value) })}
        />
        <div className="flex justify-between text-[10px] text-mist/40 mt-1">
          <span>indulgent</span>
          <span>strict</span>
        </div>
      </label>

      {/* sustain */}
      <label className="block mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-mist/80">Délai avant rappel</span>
          <span className="text-teal-soft tnum">{settings.sustainSeconds}s</span>
        </div>
        <input
          type="range"
          min={2}
          max={30}
          step={1}
          value={settings.sustainSeconds}
          onChange={(e) => update({ sustainSeconds: Number(e.target.value) })}
        />
        <div className="flex justify-between text-[10px] text-mist/40 mt-1">
          <span>vif</span>
          <span>patient</span>
        </div>
      </label>

      {/* goal */}
      <label className="block mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-mist/80">Objectif quotidien de droiture</span>
          <span className="text-teal-soft tnum">{settings.uprightGoalPct}%</span>
        </div>
        <input
          type="range"
          min={40}
          max={95}
          step={5}
          value={settings.uprightGoalPct}
          onChange={(e) => update({ uprightGoalPct: Number(e.target.value) })}
        />
      </label>

      <div className="h-px bg-slate-line my-2" />

      <Toggle
        label="Rappel visuel"
        hint="un bandeau doux apparaît"
        checked={settings.nudgeVisual}
        onChange={(v) => update({ nudgeVisual: v })}
      />
      <Toggle
        label="Carillon"
        hint="deux notes calmes"
        checked={settings.nudgeSound}
        onChange={(v) => update({ nudgeSound: v })}
      />
      <Toggle
        label="Notification système"
        hint="même fenêtre en arrière-plan"
        checked={settings.nudgeNotification}
        onChange={async (v) => {
          if (v) {
            const ok = await ensureNotificationPermission();
            update({ nudgeNotification: ok });
          } else {
            update({ nudgeNotification: false });
          }
        }}
      />

      <div className="h-px bg-slate-line my-2" />

      <Toggle
        label="Aperçu caméra"
        hint="affiche le flux + les repères"
        checked={settings.showPreview}
        onChange={(v) => update({ showPreview: v })}
      />
      <Toggle
        label="Miroir"
        hint="vue selfie"
        checked={settings.mirror}
        onChange={(v) => update({ mirror: v })}
      />

      <button
        type="button"
        disabled={!canRecalibrate}
        onClick={onRecalibrate}
        className="mt-4 w-full py-2.5 rounded-xl border border-teal/50 text-teal-soft text-sm font-medium hover:bg-teal/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Recalibrer mon aplomb
      </button>
    </div>
  );
}
