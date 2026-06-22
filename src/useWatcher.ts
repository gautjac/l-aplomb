import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDetector,
  scoreDeviation,
  type Detector,
  type Metrics,
} from "./posture";
import {
  getBaseline,
  saveBaseline,
  commitDelta,
  type Baseline,
} from "./db";

export type WatcherPhase =
  | "idle" // not started
  | "loading" // models downloading
  | "requesting" // asking for camera
  | "running" // detecting
  | "calibrating" // capturing baseline
  | "error";

export type PostureState = "absent" | "aplomb" | "drift" | "slouch";

export interface WatcherStatus {
  phase: WatcherPhase;
  error: string | null;
  detectorKind: "pose" | "face" | null;
  state: PostureState;
  deviation: number; // smoothed score
  reason: string;
  faceSeen: boolean;
  baseline: Baseline | null;
  calibrationProgress: number; // 0..1 while calibrating
  fps: number;
}

const NUDGE_LINE = 1.0; // deviation at/above this (post-gain) is a slouch
const DRIFT_LINE = 0.55; // amber threshold
const SMOOTH = 0.18; // EMA factor for deviation
const COMMIT_EVERY_MS = 4000; // flush accounting to Dexie periodically
const CALIBRATION_MS = 3500;

interface WatcherOptions {
  sensitivity: number;
  sustainSeconds: number;
  quiet: boolean; // suppress nudges entirely
  onNudge: () => void;
}

export interface Watcher {
  status: WatcherStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detectorRef: React.RefObject<Detector | null>;
  start: () => Promise<void>;
  stop: () => void;
  calibrate: () => void;
  recalibrate: () => void;
}

export function useWatcher(opts: WatcherOptions): Watcher {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const baselineRef = useRef<Baseline | null>(null);

  // mutable loop state (kept in refs so the rAF closure stays cheap)
  const lastTsRef = useRef<number>(0);
  const slouchSinceRef = useRef<number | null>(null);
  const nudgedRef = useRef<boolean>(false);
  const devEmaRef = useRef<number>(0);
  const uprightStreakRef = useRef<number>(0);
  const acc = useRef({ upright: 0, slouch: 0, watched: 0, nudges: 0 });
  const lastCommitRef = useRef<number>(0);
  const calStartRef = useRef<number | null>(null);
  const calSamplesRef = useRef<Metrics[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [status, setStatus] = useState<WatcherStatus>({
    phase: "idle",
    error: null,
    detectorKind: null,
    state: "absent",
    deviation: 0,
    reason: "",
    faceSeen: false,
    baseline: null,
    calibrationProgress: 0,
    fps: 0,
  });

  // load any saved baseline on mount
  useEffect(() => {
    getBaseline().then((b) => {
      if (b) {
        baselineRef.current = b;
        setStatus((s) => ({ ...s, baseline: b }));
      }
    });
  }, []);

  const flush = useCallback((force = false) => {
    const now = performance.now();
    if (!force && now - lastCommitRef.current < COMMIT_EVERY_MS) return;
    lastCommitRef.current = now;
    const a = acc.current;
    if (a.upright || a.slouch || a.watched || a.nudges) {
      commitDelta({
        uprightMs: a.upright,
        slouchMs: a.slouch,
        watchedMs: a.watched,
        nudges: a.nudges,
        currentStreakMs: uprightStreakRef.current,
      });
      acc.current = { upright: 0, slouch: 0, watched: 0, nudges: 0 };
    }
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const det = detectorRef.current;
    if (!video || !det || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const now = performance.now();
    const dt = lastTsRef.current ? now - lastTsRef.current : 16;
    lastTsRef.current = now;
    const fps = dt > 0 ? Math.round(1000 / dt) : 0;

    const metrics = det.detect(video, now);
    const faceSeen = !!metrics;

    // calibration capture
    if (calStartRef.current !== null) {
      const elapsed = now - calStartRef.current;
      if (metrics) calSamplesRef.current.push(metrics);
      const progress = Math.min(1, elapsed / CALIBRATION_MS);
      setStatus((s) => ({ ...s, calibrationProgress: progress, faceSeen, fps }));
      if (elapsed >= CALIBRATION_MS) {
        finishCalibration(det.kind);
      }
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    let state: PostureState = "absent";
    let reason = "";
    let smoothed = devEmaRef.current;

    if (metrics && baselineRef.current) {
      const base = baselineRef.current;
      const { score, reason: r } = scoreDeviation(
        metrics,
        base,
        optsRef.current.sensitivity,
      );
      smoothed = devEmaRef.current + SMOOTH * (score - devEmaRef.current);
      devEmaRef.current = smoothed;
      reason = r;

      if (smoothed >= NUDGE_LINE) state = "slouch";
      else if (smoothed >= DRIFT_LINE) state = "drift";
      else state = "aplomb";

      // accounting
      acc.current.watched += dt;
      if (state === "slouch") {
        acc.current.slouch += dt;
        uprightStreakRef.current = 0;
      } else {
        acc.current.upright += dt;
        uprightStreakRef.current += dt;
      }

      // sustained-slouch → nudge
      if (state === "slouch") {
        if (slouchSinceRef.current === null) slouchSinceRef.current = now;
        const held = now - slouchSinceRef.current;
        if (
          held >= optsRef.current.sustainSeconds * 1000 &&
          !nudgedRef.current &&
          !optsRef.current.quiet
        ) {
          nudgedRef.current = true;
          acc.current.nudges += 1;
          optsRef.current.onNudge();
        }
      } else {
        slouchSinceRef.current = null;
        nudgedRef.current = false;
      }
    } else if (metrics && !baselineRef.current) {
      // detecting but no baseline yet — neutral
      state = "aplomb";
      smoothed = 0;
    } else {
      // no face — pause accounting, decay deviation
      slouchSinceRef.current = null;
      nudgedRef.current = false;
      smoothed = devEmaRef.current * 0.9;
      devEmaRef.current = smoothed;
    }

    flush();

    setStatus((s) => {
      if (
        s.state === state &&
        Math.abs(s.deviation - smoothed) < 0.01 &&
        s.faceSeen === faceSeen &&
        s.reason === reason
      ) {
        return s.fps === fps ? s : { ...s, fps };
      }
      return { ...s, state, deviation: smoothed, reason, faceSeen, fps };
    });

    rafRef.current = requestAnimationFrame(loop);
  }, [flush]);

  const finishCalibration = useCallback((kind: "pose" | "face") => {
    const samples = calSamplesRef.current;
    calStartRef.current = null;
    calSamplesRef.current = [];
    if (samples.length < 5) {
      setStatus((s) => ({
        ...s,
        phase: "running",
        error: "Calibration ratée — ton visage n'était pas bien visible. Réessaie.",
        calibrationProgress: 0,
      }));
      return;
    }
    const med = (sel: (m: Metrics) => number) => {
      const arr = samples.map(sel).sort((a, b) => a - b);
      return arr[Math.floor(arr.length / 2)];
    };
    const baseline: Omit<Baseline, "id" | "createdAt"> = {
      noseToShoulderRatio: med((m) => m.noseToShoulderRatio),
      faceWidth: med((m) => m.faceWidth),
      shoulderY: med((m) => m.shoulderY),
      eyeLineY: med((m) => m.eyeLineY),
      headTilt: med((m) => m.headTilt),
      source: kind,
    };
    saveBaseline(baseline).then(() => {
      const full: Baseline = {
        ...baseline,
        id: "current",
        createdAt: Date.now(),
      };
      baselineRef.current = full;
      devEmaRef.current = 0;
      setStatus((s) => ({
        ...s,
        phase: "running",
        baseline: full,
        calibrationProgress: 0,
        error: null,
      }));
    });
  }, []);

  const start = useCallback(async () => {
    if (
      status.phase === "running" ||
      status.phase === "loading" ||
      status.phase === "requesting"
    )
      return;
    setStatus((s) => ({ ...s, phase: "loading", error: null }));
    try {
      // 1. load models (on-device WASM)
      if (!detectorRef.current) {
        detectorRef.current = await createDetector();
      }
      setStatus((s) => ({
        ...s,
        detectorKind: detectorRef.current!.kind,
        phase: "requesting",
      }));

      // 2. camera — local only, never uploaded
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Élément vidéo introuvable.");
      video.srcObject = stream;
      await video.play();

      // 3. start the loop
      lastTsRef.current = 0;
      lastCommitRef.current = performance.now();
      setStatus((s) => ({ ...s, phase: "running", error: null }));
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Accès à la caméra refusé. Autorise la caméra pour que L'Aplomb puisse veiller."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "Aucune caméra détectée sur cette machine."
            : e instanceof Error
              ? e.message
              : "Une erreur est survenue au démarrage.";
      setStatus((s) => ({ ...s, phase: "error", error: msg }));
    }
  }, [loop, status.phase]);

  const stop = useCallback(() => {
    flush(true);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    devEmaRef.current = 0;
    slouchSinceRef.current = null;
    nudgedRef.current = false;
    uprightStreakRef.current = 0;
    setStatus((s) => ({
      ...s,
      phase: "idle",
      state: "absent",
      deviation: 0,
      faceSeen: false,
    }));
  }, [flush]);

  const calibrate = useCallback(() => {
    if (!detectorRef.current || status.phase !== "running") return;
    calSamplesRef.current = [];
    calStartRef.current = performance.now();
    setStatus((s) => ({ ...s, phase: "calibrating", calibrationProgress: 0 }));
  }, [status.phase]);

  // recalibrate is just calibrate; kept distinct for intent at call sites
  const recalibrate = calibrate;

  // cleanup on unmount
  useEffect(() => {
    return () => {
      flush(true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
      detectorRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // flush on tab hide
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) flush(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [flush]);

  // calibrating phase note: we map phase in the loop, but reflect it here too
  useEffect(() => {
    if (calStartRef.current !== null && status.phase !== "calibrating") {
      setStatus((s) => ({ ...s, phase: "calibrating" }));
    }
  }, [status.phase]);

  return { status, videoRef, detectorRef, start, stop, calibrate, recalibrate };
}
