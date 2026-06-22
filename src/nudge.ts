/** Gentle, non-jarring nudges. A soft two-note chime + optional system notification. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A calm marimba-ish two-note rise. Quiet by design. */
export function playChime(): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const notes = [
    { f: 528, t: 0 },
    { f: 660, t: 0.16 },
  ];
  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = n.f;
    const start = now + n.t;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 1.0);
  }
}

/** Warms up the audio context inside a user gesture so the first chime isn't blocked. */
export function primeAudio(): void {
  audio();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

const LINES = [
  "Redresse-toi en douceur — retrouve ton aplomb.",
  "Un p'tit fil à plomb : déroule la colonne.",
  "Reviens à la verticale, sans forcer.",
  "Épaules qui descendent, menton qui recule.",
  "Respire, allonge la nuque, retrouve ta hauteur.",
];

export function notify(): void {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  const body = LINES[Math.floor(Math.random() * LINES.length)];
  try {
    new Notification("L'Aplomb", { body, silent: true, tag: "laplomb-nudge" });
  } catch {
    /* some platforms throw if not from a SW; non-fatal */
  }
}

export function nudgeLine(): string {
  return LINES[Math.floor(Math.random() * LINES.length)];
}
