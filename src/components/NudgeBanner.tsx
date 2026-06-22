import { PlumbMark } from "./PlumbMark";

interface NudgeBannerProps {
  message: string;
  onDismiss: () => void;
}

/** A calm, non-jarring reminder that slides up from the bottom. */
export function NudgeBanner({ message, onDismiss }: NudgeBannerProps) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,420px)] animate-nudgeIn">
      <div className="panel rounded-2xl px-5 py-4 shadow-calm-lg flex items-center gap-4 border-teal/40">
        <PlumbMark size={40} tone="aplomb" />
        <div className="flex-1">
          <p className="text-sm text-mist leading-snug">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          className="text-mist/40 hover:text-mist transition-colors text-lg leading-none px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
