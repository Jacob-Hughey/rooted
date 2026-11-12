/**
 * A tiny key/value store on IndexedDB (one database, one object store).
 * Values are stored with structured clone, so Maps, Dates and Errors survive as-is.
 */
const DB_NAME = "rooted";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null)); // let a later call try again
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
      }),
  );
}

export const idbGet = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => run<void>("readwrite", (s) => s.put(value, key));
export const idbDel = (key: string) => run<void>("readwrite", (s) => s.delete(key));
