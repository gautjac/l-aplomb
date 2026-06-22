/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // L'Aplomb — clinical-calm. Cool slate paper, deep teal, a plumb-line metaphor.
        // Green = aplomb, amber = relâchement.
        slate: {
          DEFAULT: "#1a2b30",
          deep: "#0e2a2e",
          panel: "#16383d",
          line: "#24474d",
        },
        mist: {
          DEFAULT: "#eef4f3",
          light: "#f7faf9",
          dim: "#dce8e6",
          shade: "#c6d8d5",
        },
        teal: {
          DEFAULT: "#15807a",
          deep: "#0d5d59",
          bright: "#2bb3a8",
          soft: "#7fd3cb",
        },
        // State language
        aplomb: "#1aa179", // green — upright
        relache: "#e0a32e", // amber — slouch
        alarme: "#d56a4a", // soft terracotta — sustained slouch
        thread: "#9fb6b3", // the plumb thread
        bob: "#0d5d59", // the plumb bob
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Outfit"', "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        calm: "0 6px 28px -10px rgba(13,93,89,0.35)",
        "calm-lg": "0 18px 50px -16px rgba(13,93,89,0.40)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        swing: {
          "0%, 100%": { transform: "rotate(-2.2deg)" },
          "50%": { transform: "rotate(2.2deg)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        nudgeIn: {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        riseIn: "riseIn 0.45s ease-out both",
        swing: "swing 4.5s ease-in-out infinite",
        breathe: "breathe 4s ease-in-out infinite",
        pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
        nudgeIn: "nudgeIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
