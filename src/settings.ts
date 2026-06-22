import { useEffect, useState } from "react";

/** User-tunable preferences. Persisted to localStorage (tiny, non-relational). */
export interface Settings {
  sensitivity: number; // 0..1 — higher = fires on smaller deviations
  sustainSeconds: number; // how long a slouch must persist before a nudge
  nudgeVisual: boolean;
  nudgeSound: boolean;
  nudgeNotification: boolean;
  showPreview: boolean; // live camera + landmark overlay
  mirror: boolean; // mirror the preview (selfie view)
  quietDuringCalls: boolean; // suppress nudges (manual "deep work / call" mode)
  uprightGoalPct: number; // daily goal for streak accounting
  onboarded: boolean;
}

export const DEFAULTS: Settings = {
  sensitivity: 0.55,
  sustainSeconds: 6,
  nudgeVisual: true,
  nudgeSound: true,
  nudgeNotification: false,
  showPreview: true,
  mirror: true,
  quietDuringCalls: false,
  uprightGoalPct: 70,
  onboarded: false,
};

const KEY = "laplomb.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable; non-fatal */
  }
}

/** React hook backing the settings object. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const update = (patch: Partial<Settings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  return [settings, update];
}
