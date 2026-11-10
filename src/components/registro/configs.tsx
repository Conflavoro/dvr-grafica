'use client';

import { Badge } from '@/components/ui/Badge';
import type {
  Attrezzatura,
  Corso,
  Dpi,
  Lavoratore,
  Scadenza,
} from '@/lib/data-source';
import type { EntityListConfig } from './EntityListView';
import { Users, HardHat, Wrench, GraduationCap, CalendarClock } from 'lucide-react';

function isExpiringSoon(dateIso?: string): boolean {
  if (!dateIso) return false;
  const days = (new Date(dateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 90;
}

const SCADENZA_TIPO_LABELS: Record<string, string> = {
  aggiornamento_dvr: 'Aggiornamento DVR',
  sopralluogo: 'Sopralluogo',
  formazione: 'Formazione',
  visita_medica: 'Visita medica',
  verifica_impianti: 'Verifica impianti',
  manutenzione_attrezzature: 'Manutenzione attrezzature',
  altro: 'Altro',
};
const PRIO_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critica: 'danger',
  alta: 'warning',
  media: 'info',
  bassa: 'neutral',
};
const STATO_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'neutral'> = {
  completata: 'success',
  in_corso: 'info',
  scaduta: 'danger',
  aperta: 'neutral',
};

export const lavoratoriConfig: EntityListConfig<Lavoratore> = {
  entity: 'lavoratori',
  icon: <Users size={28} />,
  select: (ds) => ds.lavoratori.list(),
  searchText: (x) => `${x.nome} ${x.cognome} ${x.mansione} ${x.azienda ?? ''}`,
  searchPlaceholder: 'Cerca per nome, mansione, azienda…',
  minWidth: 640,
  importPath: '/lavoratori/importa',
  importLabel: 'Importa lavoratori',
  emptyTitle: 'Nessun lavoratore registrato',
  emptyReadOnly:
    'Il consulente RSPP del tuo studio caricherà qui il registro lavoratori della tua azienda.',
  emptyImportable:
    'Importa massivamente i lavoratori da Excel o CSV per popolare il registro aziendale.',
  singular: 'lavoratore',
  needsCompany: true,
  companyRequired: true,
  crud: (ds) => ds.lavoratori,
  formFields: [
    { key: 'cognome', label: 'Cognome', type: 'text', required: true },
    { key: 'nome', label: 'Nome', type: 'text', required: true },
    { key: 'mansione', label: 'Mansione', type: 'text', required: true },
    { key: 'codice_fiscale', label: 'Codice fiscale', type: 'text', placeholder: 'RSSMRA80A01H501U' },
    { key: 'data_assunzione', label: 'Data assunzione', type: 'date' },
    { key: 'idoneita_sanitaria_data', label: 'Idoneità sanitaria (data)', type: 'date' },
    { key: 'formazione_svolta', label: 'Formazione svolta', type: 'csv', hint: 'Corsi separati da virgola.' },
    { key: 'dpi_assegnati', label: 'DPI assegnati', type: 'csv', hint: 'DPI separati da virgola.' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
  columns: [
    { key: 'nominativo', label: 'Nominativo', render: (x) => `${x.cognome} ${x.nome}`, className: 'px-4 py-3 font-semibold text-ink' },
    { key: 'mansione', label: 'Mansione', render: (x) => x.mansione },
    { key: 'azienda', label: 'Azienda', render: (x) => x.azienda ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    {
      key: 'idoneita',
      label: 'Idoneità',
      render: (x) =>
        x.idoneita_sanitaria_data ? (
          <Badge variant="success">{x.idoneita_sanitaria_data}</Badge>
        ) : (
          <Badge variant="neutral">non registrata</Badge>
        ),
    },
    {
      key: 'formazione',
      label: 'Formazione',
      render: (x) => (x.formazione_svolta?.length ? `${x.formazione_svolta.length} corsi` : 'n.d.'),
      className: 'px-4 py-3 text-ink-muted',
    },
  ],
};

export const dpiConfig: EntityListConfig<Dpi> = {
  entity: 'dpi',
  icon: <HardHat size={28} />,
  select: (ds) => ds.dpi.list(),
  searchText: (x) => `${x.tipo} ${x.norma_en ?? ''} ${x.marca ?? ''} ${x.modello ?? ''}`,
  searchPlaceholder: 'Cerca per tipo, norma EN, marca…',
  minWidth: 720,
  importPath: '/dpi/importa',
  importLabel: 'Importa DPI',
  emptyTitle: 'Catalogo DPI vuoto',
  emptyReadOnly: 'Il consulente RSPP caricherà qui il catalogo DPI assegnati alla tua azienda.',
  emptyImportable:
    'Importa il catalogo DPI da Excel o CSV. Norma EN, categoria (I/II/III), scadenze e fornitori validati automaticamente.',
  singular: 'DPI',
  needsCompany: true,
  companyRequired: false,
  crud: (ds) => ds.dpi,
  formFields: [
    { key: 'tipo', label: 'Tipo DPI', type: 'text', required: true, placeholder: 'Es. Guanti antitaglio' },
    {
      key: 'categoria',
      label: 'Categoria',
      type: 'select',
      required: true,
      options: [
        { value: 'I', label: 'I: rischi minimi' },
        { value: 'II', label: 'II: rischi intermedi' },
        { value: 'III', label: 'III: rischi gravi o irreversibili' },
      ],
    },
    { key: 'norma_en', label: 'Norma EN', type: 'text', placeholder: 'EN 388' },
    { key: 'marca', label: 'Marca', type: 'text' },
    { key: 'modello', label: 'Modello', type: 'text' },
    { key: 'fornitore', label: 'Fornitore', type: 'text' },
    { key: 'data_consegna', label: 'Data consegna', type: 'date' },
    { key: 'scadenza', label: 'Scadenza', type: 'date' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
  columns: [
    { key: 'tipo', label: 'Tipo DPI', render: (x) => x.tipo, className: 'px-4 py-3 font-semibold text-ink' },
    { key: 'norma', label: 'Norma EN', render: (x) => x.norma_en ?? 'n.d.', className: 'px-4 py-3 font-mono text-[12px] text-ink' },
    {
      key: 'cat',
      label: 'Cat.',
      render: (x) => (
        <Badge variant={x.categoria === 'III' ? 'danger' : x.categoria === 'II' ? 'warning' : 'neutral'}>
          {x.categoria}
        </Badge>
      ),
    },
    { key: 'marca', label: 'Marca / Modello', render: (x) => [x.marca, x.modello].filter(Boolean).join(' ') || 'n.d.' },
    { key: 'fornitore', label: 'Fornitore', render: (x) => x.fornitore ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    { key: 'scadenza', label: 'Scadenza', render: (x) => x.scadenza ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
  ],
};

export const attrezzatureConfig: EntityListConfig<Attrezzatura> = {
  entity: 'attrezzature',
  icon: <Wrench size={28} />,
  select: (ds) => ds.attrezzature.list(),
  searchText: (x) => `${x.codice_interno} ${x.marca ?? ''} ${x.modello ?? ''} ${x.azienda ?? ''}`,
  searchPlaceholder: 'Cerca per codice, marca, modello…',
  minWidth: 720,
  importPath: '/attrezzature/importa',
  importLabel: 'Importa attrezzature',
  emptyTitle: 'Nessuna attrezzatura registrata',
  emptyReadOnly: 'Il consulente RSPP del tuo studio caricherà qui il registro attrezzature.',
  emptyImportable:
    'Importa il registro attrezzature da Excel o CSV. Marcatura CE e manutenzioni tracciate per ogni asset.',
  singular: 'attrezzatura',
  needsCompany: true,
  companyRequired: true,
  crud: (ds) => ds.attrezzature,
  formFields: [
    { key: 'codice_interno', label: 'Codice interno', type: 'text', required: true },
    { key: 'marca', label: 'Marca', type: 'text' },
    { key: 'modello', label: 'Modello', type: 'text' },
    { key: 'marcatura_ce', label: 'Marcatura CE', type: 'boolean', placeholder: 'Attrezzatura marcata CE' },
    { key: 'anno_installazione', label: 'Anno installazione', type: 'number', min: 1900, max: 2100, placeholder: '2020' },
    { key: 'prossima_manutenzione', label: 'Prossima manutenzione', type: 'date' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
  columns: [
    { key: 'codice', label: 'Codice', render: (x) => x.codice_interno, className: 'px-4 py-3 font-mono text-[12px] text-ink' },
    { key: 'marca', label: 'Marca / Modello', render: (x) => [x.marca, x.modello].filter(Boolean).join(' ') || 'n.d.' },
    { key: 'azienda', label: 'Azienda', render: (x) => x.azienda ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    {
      key: 'ce',
      label: 'CE',
      render: (x) => (x.marcatura_ce ? <Badge variant="success">CE</Badge> : <Badge variant="warning">no CE</Badge>),
    },
    { key: 'anno', label: 'Anno', render: (x) => x.anno_installazione ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    { key: 'manut', label: 'Prossima manut.', render: (x) => x.prossima_manutenzione ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
  ],
};

export const formazioneConfig: EntityListConfig<Corso> = {
  entity: 'corsi',
  icon: <GraduationCap size={28} />,
  select: (ds) => ds.corsi.list(),
  searchText: (x) => `${x.titolo} ${x.ente_erogatore ?? ''}`,
  searchPlaceholder: 'Cerca per titolo corso, ente erogatore…',
  minWidth: 720,
  importPath: '/formazione/importa',
  importLabel: 'Importa corsi',
  emptyTitle: 'Nessun corso registrato',
  emptyReadOnly: 'Il consulente RSPP caricherà qui i corsi di formazione frequentati dai tuoi lavoratori.',
  emptyImportable:
    'Importa corsi di formazione (Accordo Stato-Regioni, antincendio, primo soccorso, RLS) da Excel o CSV.',
  singular: 'corso',
  needsCompany: true,
  companyRequired: false,
  crud: (ds) => ds.corsi,
  formFields: [
    { key: 'titolo', label: 'Titolo corso', type: 'text', required: true, placeholder: 'Es. Formazione generale (ASR)' },
    { key: 'durata_ore', label: 'Durata (ore)', type: 'number', required: true, min: 0, placeholder: '4' },
    { key: 'data_svolgimento', label: 'Data svolgimento', type: 'date' },
    { key: 'ente_erogatore', label: 'Ente erogatore', type: 'text' },
    { key: 'partecipanti', label: 'Partecipanti', type: 'csv', hint: 'Nominativi separati da virgola.' },
    { key: 'data_scadenza', label: 'Data scadenza', type: 'date' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
  columns: [
    { key: 'titolo', label: 'Corso', render: (x) => x.titolo, className: 'px-4 py-3 font-semibold text-ink' },
    { key: 'ore', label: 'Ore', render: (x) => `${x.durata_ore}h` },
    { key: 'svolto', label: 'Svolto', render: (x) => x.data_svolgimento ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    { key: 'ente', label: 'Ente', render: (x) => x.ente_erogatore ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    { key: 'part', label: 'Partecipanti', render: (x) => x.partecipanti?.length ?? 0, className: 'px-4 py-3 text-ink-muted' },
    {
      key: 'scadenza',
      label: 'Scadenza',
      render: (x) =>
        x.data_scadenza ? (
          isExpiringSoon(x.data_scadenza) ? (
            <Badge variant="warning">{x.data_scadenza}</Badge>
          ) : (
            <Badge variant="neutral">{x.data_scadenza}</Badge>
          )
        ) : (
          'n.d.'
        ),
    },
  ],
};

export const scadenzeConfig: EntityListConfig<Scadenza> = {
  entity: 'scadenze',
  icon: <CalendarClock size={28} />,
  select: (ds) => ds.scadenze.list(),
  sort: (a, b) => a.data_prevista.localeCompare(b.data_prevista),
  searchText: (x) => `${x.descrizione} ${x.responsabile ?? ''} ${x.azienda ?? ''}`,
  searchPlaceholder: 'Cerca per descrizione, responsabile, azienda…',
  minWidth: 820,
  importPath: '/scadenziario/importa',
  importLabel: 'Importa scadenze',
  emptyTitle: 'Scadenziario vuoto',
  emptyReadOnly: 'Le scadenze pianificate dal consulente RSPP per la tua azienda compariranno qui.',
  emptyImportable:
    'Importa scadenze (DVR, sopralluoghi, visite mediche, verifica impianti, manutenzioni) da Excel o CSV.',
  singular: 'scadenza',
  needsCompany: true,
  companyRequired: false,
  crud: (ds) => ds.scadenze,
  formFields: [
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: [
        { value: 'aggiornamento_dvr', label: 'Aggiornamento DVR' },
        { value: 'sopralluogo', label: 'Sopralluogo' },
        { value: 'formazione', label: 'Formazione' },
        { value: 'visita_medica', label: 'Visita medica' },
        { value: 'verifica_impianti', label: 'Verifica impianti' },
        { value: 'manutenzione_attrezzature', label: 'Manutenzione attrezzature' },
        { value: 'altro', label: 'Altro' },
      ],
    },
    { key: 'descrizione', label: 'Descrizione', type: 'text', required: true },
    { key: 'data_prevista', label: 'Data prevista', type: 'date', required: true },
    {
      key: 'priorita',
      label: 'Priorità',
      type: 'select',
      required: true,
      options: [
        { value: 'bassa', label: 'Bassa' },
        { value: 'media', label: 'Media' },
        { value: 'alta', label: 'Alta' },
        { value: 'critica', label: 'Critica' },
      ],
    },
    {
      key: 'stato',
      label: 'Stato',
      type: 'select',
      options: [
        { value: 'aperta', label: 'Aperta' },
        { value: 'in_corso', label: 'In corso' },
        { value: 'completata', label: 'Completata' },
        { value: 'scaduta', label: 'Scaduta' },
      ],
    },
    { key: 'responsabile', label: 'Responsabile', type: 'text' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
  columns: [
    { key: 'data', label: 'Data', render: (x) => x.data_prevista, className: 'px-4 py-3 font-mono text-[12px] text-ink' },
    { key: 'tipo', label: 'Tipo', render: (x) => SCADENZA_TIPO_LABELS[x.tipo] ?? x.tipo },
    { key: 'descr', label: 'Descrizione', render: (x) => x.descrizione },
    { key: 'azienda', label: 'Azienda', render: (x) => x.azienda ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    { key: 'resp', label: 'Resp.', render: (x) => x.responsabile ?? 'n.d.', className: 'px-4 py-3 text-ink-muted' },
    { key: 'prio', label: 'Priorità', render: (x) => <Badge variant={PRIO_VARIANT[x.priorita]}>{x.priorita}</Badge> },
    { key: 'stato', label: 'Stato', render: (x) => <Badge variant={STATO_VARIANT[x.stato]}>{x.stato.replace('_', ' ')}</Badge> },
  ],
};
