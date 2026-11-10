// Permission gating per ruolo - matrice completa Role × Entity × Action
// Centralizza la logica di autorizzazione lato UI. La verifica reale avverrà
// server-side su Laravel (middleware tymon/jwt-auth + policy) post-cPanel.

import type { Role } from './data-source';

export type Entity =
  | 'companies'
  | 'dvr'
  | 'lavoratori'
  | 'dpi'
  | 'attrezzature'
  | 'corsi'
  | 'scadenze'
  | 'studi'
  | 'utenti'
  | 'platform'   // configurazione piattaforma (AI keys, RAG, billing, monitoring) — solo admin_conflavoro
  | 'team';      // gestione team studio (assegnazioni, validazioni) — titolare_studio + admin_conflavoro

export type Action = 'read' | 'create' | 'import' | 'update' | 'delete' | 'approve' | 'assign';

// ============================================================
// MODELLO RUOLI — distinzioni tangibili e responsabilità reali
// ============================================================
//
// admin_conflavoro (Staff Conflavoro PMI — proprietario piattaforma):
//   Owner della piattaforma. Più membri staff Conflavoro possono avere
//   questo ruolo. Gestisce: onboarding studi affiliati, configurazione
//   piattaforma (AI provider, RAG, storage, billing, monitoring), audit
//   di sistema, reporting aggregato.
//
// titolare_studio (capo dello studio di consulenza):
//   Gestisce il proprio studio. Vede TUTTE le aziende e TUTTI i DVR
//   creati dai suoi consulenti. Assegna le aziende ai consulenti.
//   APPROVA in via definitiva i DVR finalizzati (workflow firma a 2 step:
//   consulente prepara → titolare approva).
//
// consulente (RSPP operativo):
//   Lavora SOLO sulle aziende a lui assegnate. Prepara DVR ma NON ha
//   facoltà di approvazione finale autonoma — i suoi DVR vanno in stato
//   'review' e attendono il via libera del titolare.
//
// datore_lavoro (imprenditore):
//   Read-only sui dati e DVR della sua azienda.

const MATRIX: Record<Role, Partial<Record<Entity, Action[]>>> = {
  admin_conflavoro: {
    // Proprietario piattaforma — full power amministrativo. Non opera sui
    // dati operativi (DVR/lavoratori/etc), che sono responsabilità degli
    // studi consulenza. Ha facolta' di approvazione DVR (art. 33, governance firma).
    companies: ['read', 'assign'],
    dvr: ['read', 'approve'],   // approve: governance firma DVR (art. 33)
    lavoratori: ['read'],
    dpi: ['read'],
    attrezzature: ['read'],
    corsi: ['read'],
    scadenze: ['read'],
    studi: ['read', 'create', 'import', 'update', 'delete'],
    utenti: ['read', 'create', 'import', 'update', 'delete'],
    platform: ['read', 'create', 'update', 'delete'],   // EXCLUSIVE: config piattaforma
    team: ['read'],
  },
  titolare_studio: {
    companies: ['read', 'create', 'import', 'update', 'delete', 'assign'],
    dvr: ['read', 'create', 'import', 'update', 'delete', 'approve'],   // EXCLUSIVE: approva i DVR del suo studio
    lavoratori: ['read', 'create', 'import', 'update', 'delete'],
    dpi: ['read', 'create', 'import', 'update', 'delete'],
    attrezzature: ['read', 'create', 'import', 'update', 'delete'],
    corsi: ['read', 'create', 'import', 'update', 'delete'],
    scadenze: ['read', 'create', 'import', 'update', 'delete'],
    studi: ['read'],   // il proprio studio lo gestisce via /utenti; gli studi affiliati sono di admin_conflavoro
    utenti: ['read', 'create', 'import', 'update', 'delete'],
    platform: [],
    team: ['read', 'assign'],   // EXCLUSIVE: assegna aziende ai consulenti
  },
  consulente: {
    // Operativo. NESSUN approve (workflow 2-step con titolare).
    companies: ['read', 'create', 'import', 'update'],
    dvr: ['read', 'create', 'import', 'update'],   // niente approve
    lavoratori: ['read', 'create', 'import', 'update'],
    dpi: ['read', 'create', 'import', 'update'],
    attrezzature: ['read', 'create', 'import', 'update'],
    corsi: ['read', 'create', 'import', 'update'],
    scadenze: ['read', 'create', 'import', 'update'],
    studi: ['read'],
    utenti: ['read'],
    platform: [],
    team: ['read'],   // vede team (read-only)
  },
  datore_lavoro: {
    companies: ['read'],
    dvr: ['read'],
    lavoratori: ['read'],
    dpi: ['read'],
    attrezzature: ['read'],
    corsi: ['read'],
    scadenze: ['read'],
    studi: [],
    utenti: [],
    platform: [],
    team: [],
  },
  // Utente dell'azienda cliente: i permessi veri sono per azienda (RuoliAzienda::MATRICE, in user.aziende[].permessi).
  utente_azienda: {
    companies: ['read'],
    dvr: ['read'],
    lavoratori: ['read'],
    scadenze: ['read'],
    studi: [],
    utenti: [],
    platform: [],
    team: [],
  },
};

export function can(role: Role | undefined, entity: Entity, action: Action): boolean {
  if (!role) return false;
  return MATRIX[role]?.[entity]?.includes(action) ?? false;
}
export function canImport(role: Role | undefined, entity: Entity): boolean {
  return can(role, entity, 'import');
}
export function canCreate(role: Role | undefined, entity: Entity): boolean {
  return can(role, entity, 'create');
}
export function canEdit(role: Role | undefined, entity: Entity): boolean {
  return can(role, entity, 'update');
}
export function canDelete(role: Role | undefined, entity: Entity): boolean {
  return can(role, entity, 'delete');
}
export function canApprove(role: Role | undefined, entity: Entity): boolean {
  return can(role, entity, 'approve');
}
/** Assegnazione azienda a consulente specifico: solo titolare_studio e admin_conflavoro. */
export function canAssign(role: Role | undefined, entity: Entity): boolean {
  return can(role, entity, 'assign');
}
/** Stato pratico per nascondere completamente le sezioni write (toolbar). */
export function isReadOnlyFor(role: Role | undefined, entity: Entity): boolean {
  return !canCreate(role, entity) && !canImport(role, entity) && !canEdit(role, entity);
}

const LABELS: Record<Entity, string> = {
  companies: 'Aziende',
  dvr: 'DVR',
  lavoratori: 'Lavoratori',
  dpi: 'DPI',
  attrezzature: 'Attrezzature',
  corsi: 'Formazione',
  scadenze: 'Scadenziario',
  studi: 'Studi consulenza',
  utenti: 'Utenti studio',
  platform: 'Piattaforma',
  team: 'Team studio',
};
export function entityLabel(entity: Entity): string {
  return LABELS[entity];
}

const ROLE_LABELS: Record<Role, string> = {
  admin_conflavoro: 'Admin Conflavoro',
  titolare_studio: 'Titolare studio',
  consulente: 'Consulente RSPP',
  datore_lavoro: 'Datore di lavoro',
  utente_azienda: "Utente dell'azienda",
};
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
