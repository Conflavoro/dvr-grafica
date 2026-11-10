/** Messaggi: foglio "Il tuo referente" e domande che l'assistente gira al referente (regole 21.2). */
import { lista, manda, prendi, rec, testo } from './api';

export interface Referente {
  nome: string | null;
  ruolo: string;
  email: string | null;
  telefono: string | null;
  orari: string;
  risposta: string;
  prontoIspezioni: boolean;
  domande: Array<{ domanda: string; risposta: string }>;
}

export function mappaReferente(raw: unknown): Referente {
  const r = rec(raw);
  return {
    nome: testo(r.nome),
    ruolo: testo(r.ruolo) ?? 'Referente HSE di ISFOR',
    email: testo(r.email),
    telefono: testo(r.telefono),
    orari: testo(r.orari) ?? '',
    risposta: testo(r.risposta) ?? '',
    prontoIspezioni: r.pronto_ispezioni === true,
    domande: lista(r.domande).map((d) => ({ domanda: testo(rec(d).domanda) ?? '', risposta: testo(rec(d).risposta) ?? '' })),
  };
}

export const referente = async (aziendaId: number): Promise<Referente> => mappaReferente(rec(await prendi(`/portale/aziende/${aziendaId}/referente`)).data);

/** La domanda senza risposta arriva al referente nei Messaggi come "Domanda dall'assistente: …". */
export async function giraAlReferente(aziendaId: number, domanda: string): Promise<string> {
  const r = rec(rec(await manda(`/portale/aziende/${aziendaId}/assistente/domanda`, { domanda })).data);
  return testo(r.messaggio) ?? 'Ho girato la domanda al tuo referente.';
}
