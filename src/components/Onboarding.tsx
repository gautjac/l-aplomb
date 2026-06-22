import { useState } from "react";
import { PlumbMark } from "./PlumbMark";

interface OnboardingProps {
  onDone: () => void;
}

const STEPS = [
  {
    key: "hello",
    title: "L'Aplomb",
    body: "Un fil à plomb pour ta colonne. Je veille discrètement sur ta posture pendant que tu travailles, et je te ramènes à la verticale quand tu t'affaisses.",
  },
  {
    key: "privacy",
    title: "Tout reste ici",
    body: "Toute l'analyse se fait sur ta machine, dans le navigateur. Ton image n'est jamais enregistrée, jamais envoyée, jamais téléversée. La caméra ne quitte pas l'ordinateur — point.",
  },
  {
    key: "camera",
    title: "L'accès à la caméra",
    body: "Pour te voir, j'ai besoin de la caméra. Ton navigateur va te le demander gentiment au démarrage — c'est toi qui décides, et tu peux couper la veille n'importe quand.",
  },
  {
    key: "calibrate",
    title: "Ton aplomb à toi",
    body: "On commence par capturer ta bonne posture : assieds-toi droit, tiens trois secondes. Ça devient ta référence. Tout écart se mesure par rapport à TON neutre, pas à un idéal.",
  },
] as const;

export function Onboarding({ onDone }: OnboardingProps) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-deep/85 backdrop-blur-sm">
      <div className="panel rounded-3xl max-w-md w-full p-8 shadow-calm-lg animate-riseIn">
        <div className="flex justify-center mb-5">
          <PlumbMark size={76} swing tone={last ? "aplomb" : "neutral"} />
        </div>
        <h2 className="font-display text-3xl text-center tracking-tight mb-3">
          {step.title}
        </h2>
        <p className="text-mist/75 text-center leading-relaxed text-[15px]">
          {step.body}
        </p>

        {/* progress dots */}
        <div className="flex justify-center gap-2 mt-7 mb-6">
          {STEPS.map((s, idx) => (
            <span
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-teal-bright" : "w-1.5 bg-slate-line"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-mist/45 hover:text-mist/70 transition-colors"
          >
            Passer
          </button>
          <button
            type="button"
            onClick={() => (last ? onDone() : setI(i + 1))}
            className="px-6 py-2.5 rounded-xl bg-teal hover:bg-teal-bright text-slate-deep font-semibold text-sm transition-colors shadow-calm"
          >
            {last ? "Commencer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
