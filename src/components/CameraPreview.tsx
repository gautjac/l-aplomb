import { useEffect, useRef } from "react";
import type { Detector } from "../posture";
import { POSE_CONNECTIONS, POSE_KEYPOINTS } from "../posture";
import type { PostureState } from "../useWatcher";

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detectorRef: React.RefObject<Detector | null>;
  mirror: boolean;
  show: boolean;
  state: PostureState;
}

const STATE_COLOR: Record<PostureState, string> = {
  aplomb: "#1aa179",
  drift: "#e0a32e",
  slouch: "#d56a4a",
  absent: "#9fb6b3",
};

/**
 * Live camera preview with the detected landmarks drawn over it. The "hide
 * preview" mode keeps the <video> mounted (detection must keep running) but
 * collapses it visually — the canvas overlay just isn't painted.
 */
export function CameraPreview({
  videoRef,
  detectorRef,
  mirror,
  show,
  state,
}: CameraPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const det = detectorRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!show) return;

      const lm = det?.lastLandmarks;
      if (!lm) return;

      const color = STATE_COLOR[state];
      const px = (x: number) => (mirror ? (1 - x) * w : x * w);
      const py = (y: number) => y * h;

      if (det?.kind === "pose") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        for (const [a, b] of POSE_CONNECTIONS) {
          const pa = lm[a];
          const pb = lm[b];
          if (!pa || !pb) continue;
          ctx.beginPath();
          ctx.moveTo(px(pa.x), py(pa.y));
          ctx.lineTo(px(pb.x), py(pb.y));
          ctx.stroke();
        }
        for (const idx of POSE_KEYPOINTS) {
          const p = lm[idx];
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(px(p.x), py(p.y), 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
        // plumb line dropped from the nose
        const nose = lm[0];
        if (nose) {
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = "rgba(127,211,203,0.7)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px(nose.x), py(nose.y) - 14);
          ctx.lineTo(px(nose.x), h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // face mesh — draw a sparse point cloud so it's legible, not noisy
        ctx.fillStyle = color;
        for (let i = 0; i < lm.length; i += 6) {
          const p = lm[i];
          ctx.beginPath();
          ctx.arc(px(p.x), py(p.y), 1, 0, Math.PI * 2);
          ctx.fill();
        }
        const nose = lm[1];
        if (nose) {
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = "rgba(127,211,203,0.7)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px(nose.x), 0);
          ctx.lineTo(px(nose.x), h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, detectorRef, mirror, show, state]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-line bg-black/40"
      style={{ aspectRatio: "4 / 3" }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{
          transform: mirror ? "scaleX(-1)" : "none",
          opacity: show ? 1 : 0,
        }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full"
      />
      {!show && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-mist/55">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 3l18 18M10.6 5.1A9 9 0 0121 12s-1 1.7-2.6 3.2M6.2 6.2A9 9 0 003 12s3 5 9 5a8.7 8.7 0 003.3-.65"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-xs">Aperçu masqué — la veille continue</span>
        </div>
      )}
      {/* on-device badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-slate-deep/80 backdrop-blur px-2 py-1 rounded-full text-[10px] text-teal-soft border border-slate-line/70">
        <span className="w-1.5 h-1.5 rounded-full bg-aplomb animate-pulseSoft" />
        sur l'appareil
      </div>
    </div>
  );
}
