/**
 * Stage MediaPipe's on-device assets into public/ so L'Aplomb serves them
 * itself — no runtime CDN. This is what keeps the app's "100% sur l'appareil"
 * promise honest: the vision engine and models load from our own origin, the
 * WASM version always matches the installed @mediapipe/tasks-vision, and the
 * app works offline.
 *
 * - WASM runtime: copied from node_modules (already version-matched).
 * - Models: downloaded once from Google's model store and cached locally.
 *
 * Idempotent: re-copies the WASM only when the source changes, and skips model
 * downloads that are already present. Wired to predev:vite / prebuild so the
 * assets are always staged before the app runs or ships.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  createWriteStream,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const WASM_SRC = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const WASM_DST = join(root, "public", "mediapipe", "wasm");
const MODELS_DST = join(root, "public", "mediapipe", "models");

const MODELS = [
  {
    file: "pose_landmarker_lite.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
];

// Only the loaders FilesetResolver actually requests: the SIMD build and the
// no-SIMD fallback. The *_module_internal.* (threaded) variants need COOP/COEP
// headers we don't set, so they'd never load — skip them to keep the deploy lean.
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

function copyWasm() {
  if (!existsSync(WASM_SRC)) {
    console.error(
      `[prepare-mediapipe] WASM source not found at ${WASM_SRC}. Run "npm install" first.`,
    );
    process.exit(1);
  }
  // Re-copy only when the source loader is newer than what we staged.
  const srcProbe = join(WASM_SRC, "vision_wasm_internal.js");
  const dstProbe = join(WASM_DST, "vision_wasm_internal.js");
  if (
    existsSync(dstProbe) &&
    statSync(dstProbe).mtimeMs >= statSync(srcProbe).mtimeMs
  ) {
    console.log("[prepare-mediapipe] WASM already staged — skipping copy.");
    return;
  }
  mkdirSync(WASM_DST, { recursive: true });
  for (const f of WASM_FILES) {
    copyFileSync(join(WASM_SRC, f), join(WASM_DST, f));
  }
  console.log(
    `[prepare-mediapipe] Staged WASM runtime (${WASM_FILES.length} files) → ${WASM_DST}`,
  );
}

async function downloadModel({ file, url }) {
  const dst = join(MODELS_DST, file);
  if (existsSync(dst) && statSync(dst).size > 0) {
    console.log(`[prepare-mediapipe] Model already cached — ${file}`);
    return;
  }
  mkdirSync(MODELS_DST, { recursive: true });
  console.log(`[prepare-mediapipe] Downloading model ${file}…`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${file}: HTTP ${res.status}`);
  }
  await new Promise((resolve, reject) => {
    const out = createWriteStream(dst);
    Readable.fromWeb(res.body).pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
  console.log(`[prepare-mediapipe] Cached model → ${dst}`);
}

async function main() {
  copyWasm();
  for (const m of MODELS) {
    await downloadModel(m);
  }
  console.log("[prepare-mediapipe] Done.");
}

main().catch((e) => {
  console.error("[prepare-mediapipe] Failed:", e);
  process.exit(1);
});
