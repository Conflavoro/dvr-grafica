/**
 * Estrazione keyframe da un file video nel browser tramite Canvas.
 *
 * Carica il video in un elemento <video> off-DOM, campiona `count` istanti
 * equispaziati lungo la durata, disegna ogni frame su <canvas> ridimensionando
 * al massimo di `maxDim` px mantenendo l'aspect ratio, ed esporta come JPEG.
 *
 * Ritorna un array di stringhe base64 PURA (senza prefisso data:image/...).
 * Il chiamante passa direttamente queste stringhe al campo `frames` di POST /ai/describe-video.
 *
 * Robustezza:
 * - Errori su singoli frame vengono saltati silenziosamente.
 * - Se il video non e' valido o il context 2D non e' disponibile, ritorna array vuoto.
 * - L'object URL viene revocato sempre (try/finally).
 * - TIMEOUT complessivo: un file corrotto o con codec che il browser non sa
 *   decodificare puo' non emettere MAI ne' `loadedmetadata` ne' `error` (caso
 *   reale su Safari/iOS). Senza timeout la promise resterebbe pendente per
 *   sempre e l'interfaccia mostrerebbe "analisi in corso" all'infinito.
 */
export async function extractKeyframes(
  file: File,
  count = 8,
  maxDim = 1024,
  timeoutMs = 25000
): Promise<string[]> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<string[]>((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      // Frame raccolti finora: se scatta il timeout restituiamo comunque quelli
      // gia' estratti (meglio un'analisi parziale che un blocco).
      const collected: string[] = [];
      let settled = false;
      let watchdog: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (watchdog !== null) {
          clearTimeout(watchdog);
          watchdog = null;
        }
        video.src = '';
        video.load();
      };

      const settle = (frames: string[]) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(frames);
      };

      // Watchdog: rearmato a ogni frame estratto, cosi' un video lungo ma sano
      // non viene interrotto, mentre uno bloccato si sblocca comunque.
      const armWatchdog = () => {
        if (watchdog !== null) clearTimeout(watchdog);
        watchdog = setTimeout(() => settle([...collected]), timeoutMs);
      };
      armWatchdog();

      video.addEventListener('error', () => {
        settle([...collected]);
      });

      video.addEventListener('loadedmetadata', () => {
        // BUG NOTO di Chrome/MediaRecorder: i webm registrati in-app non hanno
        // l'header di durata e riportano duration = Infinity. Era la causa dei
        // video di produzione SENZA analisi: zero fotogrammi estratti, in
        // silenzio. Workaround standard: seek a un tempo enorme forza il
        // calcolo della durata reale (evento durationchange).
        if (video.duration === Infinity) {
          const onDuration = () => {
            if (isFinite(video.duration) && video.duration > 0) {
              video.removeEventListener('durationchange', onDuration);
              video.currentTime = 0;
              beginSampling(video.duration);
            }
          };
          video.addEventListener('durationchange', onDuration);
          video.currentTime = Number.MAX_SAFE_INTEGER;
          return;
        }

        beginSampling(video.duration);
      });

      const beginSampling = (duration: number) => {
        // Video senza durata valida (es. live stream): non possiamo campionare.
        if (!isFinite(duration) || duration <= 0) {
          settle([]);
          return;
        }

        const frames = collected;
        let index = 0;

        // Calcola i count istanti equispaziati all'interno della durata.
        // Se count=1 prendiamo il frame a meta' video.
        const timestamps = Array.from({ length: count }, (_, i) => {
          if (count === 1) return duration * 0.5;
          // +0.1 e -0.1 per evitare frame neri all'inizio/fine.
          const start = Math.min(0.1, duration * 0.05);
          const end = Math.max(duration - 0.1, duration * 0.95);
          return start + (i * (end - start)) / (count - 1);
        });

        const seekNext = () => {
          if (index >= timestamps.length) {
            settle(frames);
            return;
          }
          armWatchdog();
          video.currentTime = timestamps[index];
        };

        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 360;

            // Ridimensiona mantenendo aspect ratio entro maxDim.
            const ratio = Math.min(1, maxDim / Math.max(vw, vh));
            canvas.width = Math.round(vw * ratio);
            canvas.height = Math.round(vh * ratio);

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              // Rimuovi il prefisso "data:image/jpeg;base64," -> solo la stringa base64.
              const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
              if (base64) frames.push(base64);
            }
          } catch {
            // Frame saltato silenziosamente.
          }
          index++;
          seekNext();
        });

        // Avvia il seek al primo timestamp.
        seekNext();
      };

      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
