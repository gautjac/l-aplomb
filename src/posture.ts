import {
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type PoseLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

/**
 * Posture detection — entirely on-device.
 *
 * We prefer PoseLandmarker (it sees the shoulders directly, which is the truest
 * slouch signal) and fall back to FaceLandmarker if pose can't be created. Both
 * run in VIDEO mode against the local <video> element; the frame data never
 * leaves the browser.
 */

// Served from our own origin — staged into public/mediapipe at build time by
// scripts/prepare-mediapipe.mjs. No runtime CDN: the engine version always
// matches the installed package and the app keeps working offline.
const WASM_URL = "/mediapipe/wasm";
const POSE_MODEL = "/mediapipe/models/pose_landmarker_lite.task";
const FACE_MODEL = "/mediapipe/models/face_landmarker.task";

export type DetectorKind = "pose" | "face";

export interface Detector {
  kind: DetectorKind;
  detect(video: HTMLVideoElement, timestampMs: number): Metrics | null;
  /** Landmark points (normalised 0..1) to draw, plus the segments to connect. */
  lastLandmarks: NormalizedLandmark[] | null;
  close(): void;
}

/** Normalised posture metrics extracted from a single frame. */
export interface Metrics {
  noseToShoulderRatio: number; // vertical nose→shoulder gap / face height (forward-head proxy)
  faceWidth: number; // distance proxy (bigger = leaned in)
  shoulderY: number; // mean shoulder height, normalised (down = hunched)
  eyeLineY: number; // mean eye height
  headTilt: number; // head roll in radians
}

/** Indices for FaceLandmarker (468-point mesh). */
const FACE_IDX = {
  noseTip: 1,
  leftEye: 33,
  rightEye: 263,
  chin: 152,
  forehead: 10,
  leftCheek: 234,
  rightCheek: 454,
};

/** Indices for PoseLandmarker (33-point). */
const POSE_IDX = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftShoulder: 11,
  rightShoulder: 12,
  leftEar: 7,
  rightEar: 8,
};

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

let fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null =
  null;

async function getFileset() {
  if (!fileset) {
    try {
      fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    } catch (e) {
      // The WASM runtime failed to load. MediaPipe/Emscripten can reject with a
      // non-Error (a string or number), which is how this used to surface as an
      // opaque generic message — wrap it so callers always get something useful.
      throw new Error(
        `Le moteur de vision n'a pas pu se charger (${String(
          e instanceof Error ? e.message : e,
        )}).`,
      );
    }
  }
  return fileset;
}

/** Build the best available detector. Tries pose first, then face. */
export async function createDetector(): Promise<Detector> {
  const vision = await getFileset();

  try {
    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    return makePoseDetector(pose);
  } catch {
    // GPU may be unavailable — retry pose on CPU before falling back to face.
    try {
      const pose = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      return makePoseDetector(pose);
    } catch {
      const face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
      return makeFaceDetector(face);
    }
  }
}

function makePoseDetector(pose: PoseLandmarker): Detector {
  const det: Detector = {
    kind: "pose",
    lastLandmarks: null,
    detect(video, ts) {
      let res: PoseLandmarkerResult;
      try {
        res = pose.detectForVideo(video, ts);
      } catch {
        return null;
      }
      const lm = res.landmarks?.[0];
      if (!lm) {
        det.lastLandmarks = null;
        return null;
      }
      det.lastLandmarks = lm;

      const nose = lm[POSE_IDX.nose];
      const ls = lm[POSE_IDX.leftShoulder];
      const rs = lm[POSE_IDX.rightShoulder];
      const le = lm[POSE_IDX.leftEye];
      const re = lm[POSE_IDX.rightEye];
      const lear = lm[POSE_IDX.leftEar];
      const rear = lm[POSE_IDX.rightEar];
      if (!nose || !ls || !rs || !le || !re) return null;

      const shoulderMidY = (ls.y + rs.y) / 2;
      const shoulderWidth = dist(ls, rs);
      // forward-head: gap from nose down to the shoulder line, scaled by shoulder
      // width so it's distance-invariant. When you slump, the nose drops toward
      // the shoulders → ratio shrinks.
      const noseToShoulderRatio =
        shoulderWidth > 1e-4 ? (shoulderMidY - nose.y) / shoulderWidth : 0;

      const headTilt =
        lear && rear ? Math.atan2(rear.y - lear.y, rear.x - lear.x) : 0;

      return {
        noseToShoulderRatio,
        faceWidth: shoulderWidth, // shoulder width doubles as a distance proxy
        shoulderY: shoulderMidY,
        eyeLineY: (le.y + re.y) / 2,
        headTilt,
      };
    },
    close() {
      try {
        pose.close();
      } catch {
        /* noop */
      }
    },
  };
  return det;
}

function makeFaceDetector(face: FaceLandmarker): Detector {
  const det: Detector = {
    kind: "face",
    lastLandmarks: null,
    detect(video, ts) {
      let res: FaceLandmarkerResult;
      try {
        res = face.detectForVideo(video, ts);
      } catch {
        return null;
      }
      const lm = res.faceLandmarks?.[0];
      if (!lm) {
        det.lastLandmarks = null;
        return null;
      }
      det.lastLandmarks = lm;

      const nose = lm[FACE_IDX.noseTip];
      const le = lm[FACE_IDX.leftEye];
      const re = lm[FACE_IDX.rightEye];
      const chin = lm[FACE_IDX.chin];
      const fore = lm[FACE_IDX.forehead];
      const lc = lm[FACE_IDX.leftCheek];
      const rc = lm[FACE_IDX.rightCheek];
      if (!nose || !le || !re || !chin || !fore) return null;

      const faceHeight = dist(fore, chin);
      const faceWidth = lc && rc ? dist(lc, rc) : faceHeight;
      const eyeLineY = (le.y + re.y) / 2;
      // Without shoulders, the forward-head proxy is how far the face has dropped
      // in the frame relative to its own height. We invert it so "bigger = more
      // upright" to match the pose metric's sign.
      const noseToShoulderRatio =
        faceHeight > 1e-4 ? (1 - eyeLineY) / faceHeight : 0;
      const headTilt = Math.atan2(re.y - le.y, re.x - le.x);

      return {
        noseToShoulderRatio,
        faceWidth,
        shoulderY: chin.y, // chin height stands in for the shoulder line
        eyeLineY,
        headTilt,
      };
    },
    close() {
      try {
        face.close();
      } catch {
        /* noop */
      }
    },
  };
  return det;
}

/* ----------------------------------------------------------------------- */
/* Deviation scoring                                                        */
/* ----------------------------------------------------------------------- */

export interface Deviation {
  /** 0 = perfect aplomb, grows positive as posture collapses. */
  score: number;
  /** Plain-language dominant signal. */
  reason: "forward" | "lean-in" | "drop" | "tilt" | "ok";
}

/**
 * Compare live metrics against the saved baseline. Sensitivity scales how harshly
 * deviations are weighted. Returns a unitless score where ~1.0 is the nudge line
 * at default sensitivity.
 */
export function scoreDeviation(
  live: Metrics,
  base: {
    noseToShoulderRatio: number;
    faceWidth: number;
    shoulderY: number;
    eyeLineY: number;
    headTilt: number;
  },
  sensitivity: number,
): Deviation {
  const eps = 1e-3;

  // forward-head / collapse: ratio drops below baseline
  const fwd = Math.max(
    0,
    (base.noseToShoulderRatio - live.noseToShoulderRatio) /
      (base.noseToShoulderRatio + eps),
  );

  // leaning in: face/shoulder span grows beyond baseline
  const leanIn = Math.max(
    0,
    (live.faceWidth - base.faceWidth) / (base.faceWidth + eps),
  );

  // overall vertical drop of the eye line (sinking down in the chair)
  const drop = Math.max(0, live.eyeLineY - base.eyeLineY);

  // head roll relative to baseline
  const tilt = Math.abs(live.headTilt - base.headTilt);

  // Weighted blend. Forward-head is the headline signal.
  const raw = fwd * 2.4 + leanIn * 1.5 + drop * 3.0 + tilt * 0.8;

  // sensitivity 0..1 → gain 0.55..1.9
  const gain = 0.55 + sensitivity * 1.35;
  const score = raw * gain;

  let reason: Deviation["reason"] = "ok";
  const signals: Array<[Deviation["reason"], number]> = [
    ["forward", fwd * 2.4],
    ["lean-in", leanIn * 1.5],
    ["drop", drop * 3.0],
    ["tilt", tilt * 0.8],
  ];
  signals.sort((a, b) => b[1] - a[1]);
  if (signals[0][1] > 0.05) reason = signals[0][0];

  return { score, reason };
}

/** Connection pairs for drawing a readable skeleton overlay. */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [POSE_IDX.leftShoulder, POSE_IDX.rightShoulder],
  [POSE_IDX.leftShoulder, POSE_IDX.leftEar],
  [POSE_IDX.rightShoulder, POSE_IDX.rightEar],
  [POSE_IDX.nose, POSE_IDX.leftEye],
  [POSE_IDX.nose, POSE_IDX.rightEye],
];

export const POSE_KEYPOINTS = [
  POSE_IDX.nose,
  POSE_IDX.leftEye,
  POSE_IDX.rightEye,
  POSE_IDX.leftEar,
  POSE_IDX.rightEar,
  POSE_IDX.leftShoulder,
  POSE_IDX.rightShoulder,
];

export { POSE_IDX, FACE_IDX };
