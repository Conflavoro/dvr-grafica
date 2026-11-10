/**
 * Avviso dopo l'accesso al Safety Passport. Con l'orario di scadenza dei link
 * la durata generica scritta dal server ("i link scadono dopo 15 minuti") e'
 * superflua: resta una frase sola con l'ora esatta.
 */
export function avvisoPassaporto(avviso: string, oraScadenza: string | null): string {
  if (!oraScadenza) return avviso;
  const base = avviso.replace(/[;,.]?\s*i link scadono dopo \d+ minuti\.?\s*$/i, '.').trim();
  return `${base} I link restano validi fino alle ${oraScadenza}.`;
}
