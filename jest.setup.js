// Polyfill minimi per i test del DataSource in ambiente node.
// lib/api.ts usa window/localStorage/sessionStorage per il JWT: li simuliamo.

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    this.store.set(String(k), String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { pathname: '/', href: '/' },
    localStorage,
    sessionStorage,
  };
}
globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
