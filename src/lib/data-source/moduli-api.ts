// Namespace `documentiHse` e `coda` verso il backend Laravel.
//
// L'elenco del tavolo unisce quattro fonti (DVR, POS, valutazioni specifiche,
// documenti HSE): se una non risponde le altre restano visibili con un avviso,
// cosi' un modulo fermo non nasconde i documenti degli altri.

import { ApiError, api, apiUrl, getToken } from '@/lib/api';
import { mapDvrFromApi, unwrapList, type ApiDvr } from './api-mappers';
import { mapPos } from './agente-mappers';
import { mapProposta, mapRigaDocumentoHse, mapRigaValutazione } from './moduli-mappers';
import type { CodaDataSource, DocumentiHseDataSource, DocumentoAzienda, OrigineDocumento, PropostaAgenteVoce } from './moduli-types';
import { consegnaFile } from '@/lib/app/file-recenti';

/** Testo leggibile per ogni stato HTTP: cosa e' successo e cosa fare. */
export function testoErroreHttp(status: number, messaggio?: string | null): string {
  if (status === 0) return 'Connessione assente o interrotta. Controlla la rete e riprova.';
  if (status === 403) return messaggio && /[a-z]{4}/i.test(messaggio) && !/forbidden|unauthorized|this action/i.test(messaggio) ? messaggio : 'Operazione non consentita per il tuo ruolo.';
  if (status === 404) return 'Risorsa non trovata.';
  if (status === 408) return 'Il server non ha risposto in tempo. Riprova tra poco.';
  if (status === 413) return 'Il file è troppo grande per il server (limite 24 MB). Dividilo in parti più piccole e riprova.';
  if (status === 422) return messaggio || 'Dati non validi.';
  if (status === 429) return 'Troppe richieste in poco tempo. Attendi un minuto e riprova.';
  if (status >= 500) return 'Il server ha avuto un problema. Riprova tra qualche minuto; se si ripete, avvisa lo studio.';
  return messaggio || 'Operazione non riuscita. Riprova.';
}

function erroreLeggibile(e: unknown, riserva: string): Error {
  if (e instanceof ApiError) {
    const body = (e.body ?? {}) as { message?: string; codice?: string; errors?: Record<string, string[]> };
    const primo = body.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    // Demo dal vivo: tetti giornalieri e file oltre il limite hanno già il messaggio giusto.
    const demo = (body.codice === 'tetto_demo' || body.codice === 'file_troppo_grande') && body.message ? body.message : null;
    const err = new Error(demo ?? testoErroreHttp(e.status, primo ?? body.message ?? null)) as Error & { status?: number };
    err.status = e.status;
    return err;
  }
  return e instanceof Error ? e : new Error(riserva);
}

const PERCORSO: Record<OrigineDocumento, (id: number, f: 'pdf' | 'docx') => string> = {
  dvr: (id, f) => `/dvr/${id}/download/${f}`,
  pos: (id, f) => `/pos/${id}/download/${f}`,
  valutazione: (id, f) => `/valutazioni/${id}/download/${f}`,
  hse: (id, f) => `/documenti-hse/${id}/download/${f}`,
};

const NON_PRONTO: Record<OrigineDocumento, string> = {
  dvr: 'Il DVR non ha ancora un file generato: chiedi all’agente di generarlo.',
  pos: 'Il POS non ha ancora una revisione emessa.',
  valutazione: 'La valutazione non ha ancora un file: chiedi all’agente l’anteprima della bozza.',
  hse: 'Il documento non ha ancora un file: chiedi all’agente l’anteprima della bozza.',
};

/** Download con timeout: nessuna attesa infinita su un file che non arriva. */
export async function scaricaFile(path: string, nome: string, msg404: string, timeoutMs = 120_000): Promise<void> {
  const token = getToken();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl?.signal });
  } catch (e) {
    const scaduto = e instanceof Error && e.name === 'AbortError';
    throw new Error(scaduto ? 'Il file non è arrivato in tempo. Riprova tra poco.' : testoErroreHttp(0));
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    let msg: string | null = null;
    try {
      msg = ((await res.json()) as { message?: string })?.message ?? null;
    } catch {
      /* risposta non JSON */
    }
    throw new Error(res.status === 404 ? msg404 : testoErroreHttp(res.status, msg));
  }
  await consegnaFile(await res.blob(), nomeDaRisposta(res) ?? nome, path);
}

function nomeDaRisposta(res: Response): string | null {
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : null;
}

const ordine = (a: DocumentoAzienda, b: DocumentoAzienda) => String(b.aggiornato ?? '').localeCompare(String(a.aggiornato ?? ''));

export function creaDocumentiHseApi(): DocumentiHseDataSource {
  return {
    elenco: async (companyId: number) => {
      const q = `company_id=${companyId}&per_page=100`;
      const fonti: Array<[string, Promise<DocumentoAzienda[]>]> = [
        [
          'DVR',
          api.get<unknown>(`/dvr?${q}`).then((r) =>
            unwrapList<ApiDvr>(r)
              .map(mapDvrFromApi)
              .filter((d) => d.company_id === companyId)
              .map(
                (d): DocumentoAzienda => ({
                  chiave: `dvr:${d.id}`,
                  origine: 'dvr',
                  id: d.id,
                  tipo: 'dvr',
                  titolo: `DVR versione ${d.versione}`,
                  stato: d.status,
                  revisione: null,
                  aggiornato: d.generated_at ?? d.data_creazione ?? null,
                  puo_emettere: null,
                  conteggi: null,
                  esito: null,
                })
              )
          ),
        ],
        [
          'POS',
          api.get<unknown>(`/pos?${q}`).then((r) =>
            unwrapList<unknown>(r)
              .map(mapPos)
              .filter((p): p is NonNullable<typeof p> => p !== null && p.company_id === companyId)
              .map(
                (p): DocumentoAzienda => ({
                  chiave: `pos:${p.id}`,
                  origine: 'pos',
                  id: p.id,
                  tipo: 'pos',
                  titolo: `POS n. ${p.id}`,
                  stato: p.stato,
                  revisione: p.revisione_corrente,
                  aggiornato: p.aggiornato ?? p.emesso_il,
                  puo_emettere: null,
                  conteggi: null,
                  esito: null,
                })
              )
          ),
        ],
        ['valutazioni specifiche', api.get<unknown>(`/valutazioni?${q}`).then((r) => unwrapList<unknown>(r).map(mapRigaValutazione).filter((x): x is DocumentoAzienda => x !== null))],
        ['documenti HSE', api.get<unknown>(`/documenti-hse?${q}`).then((r) => unwrapList<unknown>(r).map(mapRigaDocumentoHse).filter((x): x is DocumentoAzienda => x !== null))],
      ];
      const esiti = await Promise.allSettled(fonti.map(([, p]) => p));
      const documenti: DocumentoAzienda[] = [];
      const avvisi: string[] = [];
      esiti.forEach((e, i) => {
        if (e.status === 'fulfilled') documenti.push(...e.value);
        else avvisi.push(`Elenco ${fonti[i][0]} non disponibile: ${erroreLeggibile(e.reason, 'errore').message}`);
      });
      if (documenti.length === 0 && avvisi.length === fonti.length) {
        throw erroreLeggibile(esiti.find((e): e is PromiseRejectedResult => e.status === 'rejected')?.reason, 'Documenti non disponibili.');
      }
      return { documenti: documenti.sort(ordine), avvisi };
    },
    scarica: async (origine, id, formato) => {
      await scaricaFile(PERCORSO[origine](id, formato), `${origine}_${id}.${formato}`, NON_PRONTO[origine]);
    },
  };
}

export function creaCodaApi(): CodaDataSource {
  return {
    decidi: async (id: number, decisione: 'approva' | 'respingi', nota?: string): Promise<PropostaAgenteVoce> => {
      try {
        const r = await api.post<{ data?: { proposta?: unknown }; proposta?: unknown }>(`/portale/coda/${id}/${decisione}`, nota ? { nota } : {});
        const p = mapProposta(r?.data?.proposta ?? r?.proposta ?? (r as { data?: unknown })?.data);
        if (!p) throw new Error('Risposta del server non valida.');
        return p;
      } catch (e) {
        throw erroreLeggibile(e, 'Decisione non registrata.');
      }
    },
  };
}
