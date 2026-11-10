#!/usr/bin/env node
// Costruisce il frontend per l'app (App Store e Google Play) e lo copia nei progetti nativi.
//
// 1. export statico di Next con l'API assoluta del server di produzione
//    (nell'app le pagine stanno sul telefono, il backend resta su dvr.conflavoro.it);
// 2. copia di ogni cartella/index.txt in cartella.txt: Next chiede i dati della pagina
//    a /pagina.txt e sul server ci pensa l'.htaccess, nell'app no;
// 3. cap sync (se i progetti nativi esistono) oppure cap copy.
//
// Uso: pnpm build:app            (build + sync)
//      pnpm build:app --solo-web (solo export, senza Capacitor)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, copyFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const identita = JSON.parse(readFileSync(join(radice, 'app.config.json'), 'utf8'));
const soloWeb = process.argv.includes('--solo-web');

function esegui(comando, argomenti, env = {}) {
  const r = spawnSync(comando, argomenti, {
    cwd: radice,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const env = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || identita.apiBaseUrl,
  NEXT_PUBLIC_USE_API: 'true',
  NEXT_PUBLIC_APP_NATIVA: 'true',
  NEXT_PUBLIC_BASE_PATH: '',
};
if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
  console.warn('Attenzione: NEXT_PUBLIC_GOOGLE_CLIENT_ID non impostato, il pulsante Google non funzionera.');
}

esegui('npx', ['next', 'build'], env);

// Payload delle pagine anche come cartella.txt.
let copiati = 0;
function giro(cartella) {
  for (const nome of readdirSync(cartella)) {
    const p = join(cartella, nome);
    if (!statSync(p).isDirectory()) continue;
    const indice = join(p, 'index.txt');
    if (existsSync(indice) && !existsSync(`${p}.txt`)) {
      copyFileSync(indice, `${p}.txt`);
      copiati += 1;
    }
    giro(p);
  }
}
giro(join(radice, 'out'));
console.log(`Payload delle pagine copiati: ${copiati}`);

if (soloWeb) process.exit(0);
const nativi = existsSync(join(radice, 'android')) || existsSync(join(radice, 'ios'));
esegui('npx', ['cap', nativi ? 'sync' : 'copy']);
