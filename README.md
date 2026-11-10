# Piattaforma HSE Conflavoro: interfaccia

Copia dell'interfaccia (frontend) della piattaforma, per il lavoro sulla grafica. Il backend resta in un repository privato: qui ci sono le schermate, i componenti e il sistema dei colori.

Demo dal vivo con i profili già pronti: https://dvr.conflavoro.it/demo/

## Avvio

```bash
npm install
npm run dev
```

Senza backend l'interfaccia gira con dati finti nel browser. Per vedere i dati della demo:

```bash
NEXT_PUBLIC_USE_API=true NEXT_PUBLIC_API_BASE_URL=https://dvr.conflavoro.it/demo/api npm run dev
```

## Dove sta la grafica

- `tailwind.config.ts`: tutti i colori ammessi. Grafite (neutri), acid (verde acido), le tinte delle categorie (`cat-*`), gli stati `ok`, `warn`, `danger`, `info`, la scala del rischio `risk-*` (solo matrice P x G).
- `src/app/globals.css`: variabili delle superfici (`--hse-canvas`, `--hse-surface`, `--hse-fg`...), font, classi di base.
- `src/components/portale/`: guscio dell'app (menu, Falco di sezione, campanella, ricerca) e le viste di gestionale e area azienda (`viste/`).
- `src/components/agente/`: Falco e pannelli.
- `public/brand/`: logo, Falco, illustrazioni.
- `src/app/(app)/`: prima versione dell'interfaccia, non si usa più. Con il backend vero ogni sua pagina porta alla schermata nuova del portale: il lavoro grafico va su `src/components/portale/`.

## Regola sui colori

Nel codice si usano solo i nomi del sistema (per esempio `bg-ok`, `text-danger-mark`, `bg-grafite-100`), mai esadecimali scritti a mano né la tavolozza standard di Tailwind (`red-500`, `blue-600`...). Unica eccezione: il logo Google nel pulsante di accesso. Per cambiare un colore si cambia il valore in `tailwind.config.ts`, e cambia ovunque.

## Lavoro insieme

La struttura (dati, flussi, comportamento del Falco) la seguiamo noi; la parte visiva è tua. Proponi le modifiche con una pull request o con i file di design, e le portiamo nella piattaforma.
