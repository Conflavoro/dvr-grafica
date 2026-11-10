/** Ricerca dei documenti HSE nel computer della persona: logica pura, contenuto letto in locale. */
export * from './riconosci'
export * from './cerca-file'
export { creaLettori, FILE_LETTORI } from './lettori'
export { contenutoP7m, testoDaDocx, vociZip } from './archivio'
export type { VoceZip } from './archivio'
export { cercaLoghi, valutaLoghiScelti, valutaLogo, paroleAzienda, BYTE_LOGO, ESTENSIONI_LOGO } from './logo'
export type { LogoTrovato } from './logo'
