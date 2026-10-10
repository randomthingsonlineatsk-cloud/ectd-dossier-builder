// Minimal IndexedDB wrapper. Everything stays in the user's browser.
const DB_NAME = 'ectd-dossier-builder';
const DB_VERSION = 1;
const STORES = { projects: 'id', attempts: 'id', meta: 'key' };

let dbPromise = null;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const os = db.createObjectStore(name, { keyPath });
          if (name !== 'meta') { os.createIndex('userId', 'userId'); os.createIndex('classId', 'classId'); }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  all: (store) => tx(store, 'readonly', (os) => os.getAll()),
  get: (store, key) => tx(store, 'readonly', (os) => os.get(key)),
  put: (store, value) => tx(store, 'readwrite', (os) => { os.put(value); return value; }),
  del: (store, key) => tx(store, 'readwrite', (os) => os.delete(key)),
};

export async function getMeta(key, fallback = null) {
  const r = await db.get('meta', key);
  return r ? r.value : fallback;
}
export const setMeta = (key, value) => db.put('meta', { key, value });

// Local identity. classId stays null until classroom mode (Phase 4).
export async function getUser() {
  let u = await getMeta('user');
  if (!u) {
    u = { userId: `u-${crypto.randomUUID()}`, classId: null, displayName: '', createdAt: new Date().toISOString() };
    await setMeta('user', u);
  }
  return u;
}

export async function saveProject(p) { return db.put('projects', structuredClone(p)); }
export async function saveAttempt(a) { return db.put('attempts', structuredClone(a)); }
