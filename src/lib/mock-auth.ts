// Mock auth client per demo pubblica.
//
// In produzione (post-cPanel) viene sostituito da `src/lib/api.ts` con JWT
// reale verso Laravel `/api/auth/login`. La forma del User e' la stessa,
// quindi tutto il resto del frontend e' switch-friendly.

'use client';

export type Role =
  | 'admin_conflavoro'
  | 'titolare_studio'
  | 'consulente'
  | 'datore_lavoro'
  | 'utente_azienda';

export interface DemoUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  tenant_id: number | null;
  tenant_name: string;
  mfa_enabled: boolean;
  /** true finché l'onboarding non e' completato (scelta ruolo + profilo). */
  needs_onboarding?: boolean;
  avatar_url?: string;
}

export interface RoleConfig {
  role: Role;
  label: string;
  shortDescription: string;
  defaultUser: DemoUser;
  homePath: string;
  /** Sezioni nav abilitate per questo ruolo, in ordine */
  nav: Array<{
    href: string;
    label: string;
    icon: NavIcon;
  }>;
}

export type NavIcon =
  | 'falco'
  | 'dashboard'
  | 'building'
  | 'document'
  | 'shield'
  | 'graduation'
  | 'helmet'
  | 'calendar'
  | 'folder'
  | 'users'
  | 'settings'
  | 'analytics'
  | 'tenants'
  | 'workers'
  | 'tools'
  | 'registro'
  | 'sopralluogo';

const TOKEN_KEY = 'crm_dvr_demo_user';

// ============================================================
// Configurazione 5 ruoli (demo)
// ============================================================
export const ROLES: Record<Role, RoleConfig> = {
  admin_conflavoro: {
    role: 'admin_conflavoro',
    label: 'Admin Conflavoro',
    shortDescription: 'Staff Conflavoro PMI: gestione completa della piattaforma e onboarding degli studi',
    defaultUser: {
      id: 1,
      name: 'Roberto Capobianco',
      email: 'roberto@conflavoropmi.com',
      role: 'admin_conflavoro',
      tenant_id: 1,
      tenant_name: 'Conflavoro PMI',
      mfa_enabled: true,
    },
    homePath: '/gestionale/coda/',
    nav: [
      { href: '/agente', label: 'Agente', icon: 'falco' },
      { href: '/dashboard', label: 'Panoramica', icon: 'dashboard' },
      { href: '/tenants', label: 'Studi affiliati', icon: 'tenants' },
      { href: '/utenti', label: 'Utenti studi', icon: 'users' },
      { href: '/kb', label: 'Catalogo normativo', icon: 'shield' },
      { href: '/analytics', label: 'Reporting Conflavoro', icon: 'analytics' },
      { href: '/piattaforma', label: 'Configurazione piattaforma', icon: 'settings' },
      { href: '/piattaforma/audit', label: 'Audit di sistema', icon: 'shield' },
    ],
  },
  titolare_studio: {
    role: 'titolare_studio',
    label: 'Titolare Studio',
    shortDescription: 'Titolare di studio di consulenza, gestisce consulenti e clienti',
    defaultUser: {
      id: 2,
      name: 'Avv. Marco Rossi',
      email: 'm.rossi@studiorossi.it',
      role: 'titolare_studio',
      tenant_id: 12,
      tenant_name: 'Studio Rossi & Partners',
      mfa_enabled: false,
    },
    homePath: '/gestionale/coda/',
    nav: [
      { href: '/agente', label: 'Agente', icon: 'falco' },
      { href: '/dashboard', label: 'Panoramica', icon: 'dashboard' },
      { href: '/sopralluogo', label: 'Sopralluogo', icon: 'sopralluogo' },
      { href: '/aziende', label: 'Aziende clienti', icon: 'building' },
      { href: '/dvr', label: 'DVR · approvazioni', icon: 'document' },
      { href: '/scadenziario', label: 'Scadenziario', icon: 'calendar' },
      { href: '/team', label: 'Team & consulenti', icon: 'users' },
      { href: '/kb', label: 'Catalogo normativo', icon: 'shield' },
      { href: '/analytics', label: 'Performance studio', icon: 'analytics' },
    ],
  },
  consulente: {
    role: 'consulente',
    label: 'Consulente RSPP',
    shortDescription: 'RSPP o consulente operativo, crea DVR per le sue aziende clienti',
    defaultUser: {
      id: 3,
      name: 'Ing. Laura Bianchi',
      email: 'l.bianchi@studiorossi.it',
      role: 'consulente',
      tenant_id: 12,
      tenant_name: 'Studio Rossi & Partners',
      mfa_enabled: false,
    },
    homePath: '/gestionale/coda/',
    nav: [
      { href: '/agente', label: 'Agente', icon: 'falco' },
      { href: '/dashboard', label: 'Panoramica', icon: 'dashboard' },
      { href: '/sopralluogo', label: 'Sopralluogo', icon: 'sopralluogo' },
      { href: '/aziende', label: 'Le mie aziende', icon: 'building' },
      { href: '/dvr', label: 'I miei DVR', icon: 'document' },
      { href: '/scadenziario', label: 'Scadenze', icon: 'calendar' },
      { href: '/kb', label: 'Catalogo normativo', icon: 'shield' },
    ],
  },
  datore_lavoro: {
    role: 'datore_lavoro',
    label: 'Datore di Lavoro',
    shortDescription: 'Imprenditore, visualizza i DVR della propria azienda',
    defaultUser: {
      id: 4,
      name: 'Geom. Paolo Verdi',
      email: 'p.verdi@verdicostruzioni.it',
      role: 'datore_lavoro',
      tenant_id: 145,
      tenant_name: 'Verdi Costruzioni Srl',
      mfa_enabled: false,
    },
    homePath: '/azienda/dashboard/',
    nav: [
      { href: '/agente', label: 'Agente', icon: 'falco' },
      { href: '/dashboard', label: 'Panoramica', icon: 'building' },
      { href: '/dvr', label: 'I miei DVR', icon: 'document' },
      { href: '/scadenziario', label: 'Scadenze', icon: 'calendar' },
      { href: '/documenti', label: 'Documenti', icon: 'folder' },
    ],
  },
  utente_azienda: {
    role: 'utente_azienda',
    label: "Utente dell'azienda",
    shortDescription: "Referente, consulente del lavoro o medico competente dell'azienda cliente",
    defaultUser: {
      id: 6,
      name: 'Marta Neri',
      email: 'm.neri@verdicostruzioni.it',
      role: 'utente_azienda',
      tenant_id: 145,
      tenant_name: 'Verdi Costruzioni Srl',
      mfa_enabled: false,
    },
    homePath: '/azienda/dashboard/',
    nav: [{ href: '/agente', label: 'Agente', icon: 'falco' }],
  },
};

// ============================================================
// Auth state (localStorage)
// ============================================================
export function getCurrentUser(): DemoUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoUser;
  } catch {
    return null;
  }
}

export function loginAs(role: Role): DemoUser {
  const user = ROLES[role].defaultUser;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(user));
  // Dispatch evento per forzare re-render in altri tab/components
  window.dispatchEvent(new CustomEvent('auth-changed'));
  return user;
}

export function loginCustom(email: string, password: string): DemoUser | null {
  // Demo: accetta qualsiasi password >=8 char per email che matcha un ruolo
  if (password.length < 8) return null;

  for (const cfg of Object.values(ROLES)) {
    if (cfg.defaultUser.email.toLowerCase() === email.toLowerCase()) {
      return loginAs(cfg.role);
    }
  }
  return null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent('auth-changed'));
}

export function getRoleConfig(role: Role): RoleConfig {
  return ROLES[role];
}

// ============================================================
// Google login + onboarding (demo / mock)
// ============================================================

/** Persiste lo stato utente correntemente loggato. */
function setCurrentUser(user: DemoUser): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth-changed'));
}

/**
 * Simula un login Google in modalita demo. Crea un utente "nuovo" privo di
 * ruolo definitivo (parte come consulente placeholder) e con
 * needs_onboarding=true, cosi la UI lo instrada a /onboarding come avverrebbe
 * con il backend reale al primo accesso.
 *
 * Nota: se esiste gia' un utente onboarded in localStorage, lo riusa (login
 * ripetuto = utente che ha gia' completato l'onboarding).
 */
export function loginWithGoogleMock(profile?: {
  name?: string;
  email?: string;
  avatar_url?: string;
}): DemoUser {
  const existing = getCurrentUser();
  if (existing && existing.needs_onboarding === false) {
    // Utente gia' onboarded: login Google ripetuto.
    setCurrentUser(existing);
    return existing;
  }
  // In demo usiamo il profilo reale decodificato dall'ID token Google (nome,
  // email, foto) cosi' l'esperienza e' autentica; il ruolo si sceglie in onboarding.
  const user: DemoUser = {
    id: 9000,
    name: profile?.name?.trim() || 'Utente Google',
    email: profile?.email?.trim() || 'utente.google@gmail.com',
    role: 'consulente', // placeholder: verra' deciso in onboarding
    tenant_id: null,
    tenant_name: 'Da configurare',
    mfa_enabled: false,
    needs_onboarding: true,
    avatar_url: profile?.avatar_url,
  };
  setCurrentUser(user);
  return user;
}

/**
 * Applica i dati di onboarding all'utente corrente: assegna il ruolo scelto,
 * deriva un tenant_name leggibile e marca needs_onboarding=false.
 */
export function applyOnboardingMock(input: {
  role: Role;
  tenant_name?: string;
}): DemoUser {
  const current = getCurrentUser();
  const base = current ?? loginWithGoogleMock();
  const updated: DemoUser = {
    ...base,
    role: input.role,
    tenant_name: input.tenant_name || ROLES[input.role].defaultUser.tenant_name,
    tenant_id: base.tenant_id ?? ROLES[input.role].defaultUser.tenant_id,
    needs_onboarding: false,
  };
  setCurrentUser(updated);
  return updated;
}
