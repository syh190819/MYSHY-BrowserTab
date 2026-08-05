import { STORES } from './stores';

const DB_NAME = 'browser-workbench';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  return (await run(storeName, 'readonly', (s) => s.getAll())) as T[];
}

export async function putRecord<T>(storeName: string, record: T): Promise<number> {
  return (await run(storeName, 'readwrite', (s) => s.put(record))) as number;
}

export async function deleteRecord(storeName: string, id: number): Promise<void> {
  await run(storeName, 'readwrite', (s) => s.delete(id));
}

export async function clearStore(storeName: string): Promise<void> {
  await run(storeName, 'readwrite', (s) => s.clear());
}

export async function exportAll(): Promise<Record<string, unknown[]>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...STORES], 'readonly');
    const out: Record<string, unknown[]> = {};
    let remaining = STORES.length;
    tx.onerror = () => reject(tx.error);
    for (const name of STORES) {
      const req = tx.objectStore(name).getAll();
      req.onsuccess = () => {
        out[name] = req.result as unknown[];
        remaining -= 1;
        if (remaining === 0) resolve(out);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function importAll(data: Record<string, unknown[]>): Promise<void> {
  const db = await openDB();
  const names = Object.keys(data).filter((n) => (STORES as readonly string[]).includes(n));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) {
      const store = tx.objectStore(name);
      store.clear();
      for (const record of data[name]) {
        store.put(record);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function resetDBForTests(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => undefined);
    dbPromise = null;
  }
}
