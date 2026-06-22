# L'Aplomb — le fil à plomb de ta colonne

Un veilleur de posture **local-first**. La caméra est lue et analysée
**entièrement dans le navigateur, sur ta machine** : aucune image n'est
enregistrée, aucune n'est téléversée, aucun serveur ne voit ton visage.

## Comment ça marche

1. **Démarrer la veille** — autorise la caméra (la demande vient de ton
   navigateur). MediaPipe Tasks Vision (PoseLandmarker, avec repli sur
   FaceLandmarker) tourne en WASM, en boucle `requestAnimationFrame`.
2. **Calibrer ton aplomb** — assieds-toi droit, tiens ~3 s. On capture la
   médiane de tes métriques (rapport nez↔épaules, largeur du visage comme proxy
   de distance, ligne des yeux, roulis de la tête) comme **ton** neutre.
3. **Veille continue** — chaque image est comparée à la base. Tête vers l'avant,
   affaissement, rapprochement de l'écran et inclinaison sont pondérés en un
   score d'écart lissé. Sensibilité et délai de maintien réglables.
4. **Rappel doux** — au-delà du seuil maintenu : bandeau calme, carillon deux
   notes optionnel, notification système optionnelle. Snooze 25/50 min +
   bascule « silence pendant les appels / rendus ».
5. **Droiture quotidienne** — chaque session est rangée dans Dexie (IndexedDB).
   Sparkline 14 jours, série de jours atteignant l'objectif, meilleure tenue
   d'affilée, indicateur vivant vert/ambre.
6. **Le Souffleur** (facultatif) — un mot chaleureux de Claude sur ta journée.
   **Seuls tes chiffres** de droiture sont envoyés ; jamais ton image.

## Pile

Vite + React 19 + TypeScript + Tailwind v3 + Dexie + `@mediapipe/tasks-vision`.
Une fonction Netlify (`souffleur`) appelle l'API Claude (Opus, NDJSON keepalive).

## Dév

```bash
npm install
npm run dev      # netlify dev (fonctions + vite)
npm run build    # tsc -b && vite build
```

## Vie privée

Le flux caméra ne quitte jamais l'appareil. Seules des statistiques chiffrées
(pourcentages de droiture par jour) sont stockées localement dans IndexedDB.
L'analyse de posture est une **heuristique**, pas un diagnostic médical.
