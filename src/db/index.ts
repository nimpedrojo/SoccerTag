/* Minimal IndexedDB helper for SoccerTag (no external deps). */
import { MatchEvent, MatchMeta, StoredMatchEvent } from "../types/models";

const DB_NAME = "soccertag-db";
const DB_VERSION = 1;

type IDBDatabaseProm = Promise<IDBDatabase>;
let dbPromise: IDBDatabaseProm | null = null;

const getDB = (): IDBDatabaseProm => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("match_meta")) {
        db.createObjectStore("match_meta", { keyPath: "matchId" });
      }
      if (!db.objectStoreNames.contains("match_events")) {
        const store = db.createObjectStore("match_events", { keyPath: "eventId" });
        store.createIndex("matchId", "matchId", { unique: false });
        store.createIndex("matchId_createdAt", ["matchId", "createdAt"], { unique: false });
      }
      if (!db.objectStoreNames.contains("pending_exports")) {
        db.createObjectStore("pending_exports", { keyPath: "id", autoIncrement: true });
      }
    };
  });
  return dbPromise;
};

const tx = async <T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (stores: IDBObjectStore | IDBObjectStore[]) => Promise<T> | T
): Promise<T> => {
  const db = await getDB();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const transaction = db.transaction(names, mode);
  const stores = names.map((n) => transaction.objectStore(n));
  const prom = Promise.resolve(
    fn(names.length === 1 ? stores[0] : (stores as IDBObjectStore[]))
  );
  return new Promise<T>((resolve, reject) => {
    transaction.oncomplete = () => prom.then(resolve).catch(reject);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

export const saveMatchMeta = (meta: MatchMeta) =>
  tx("match_meta", "readwrite", async (store) => {
    store.put(meta);
  });

export const getMatchMeta = (matchId: string): Promise<MatchMeta | undefined> =>
  tx("match_meta", "readonly", async (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(matchId);
      req.onsuccess = () => resolve(req.result as MatchMeta | undefined);
      req.onerror = () => reject(req.error);
    });
  });

export const saveMatchEvent = (event: StoredMatchEvent) =>
  tx("match_events", "readwrite", async (store) => {
    store.put(event);
  });

export const getEventsByMatch = (matchId: string): Promise<MatchEvent[]> =>
  tx("match_events", "readonly", async (store) => {
    const index = store.index("matchId_createdAt");
    const range = IDBKeyRange.bound([matchId, 0], [matchId, Number.MAX_SAFE_INTEGER]);
    const results: MatchEvent[] = [];
    return new Promise((resolve, reject) => {
      const cursorReq = index.openCursor(range, "next");
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const value = cursor.value as StoredMatchEvent;
          results.push(value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  });

export const deleteLastEvent = (matchId: string): Promise<MatchEvent | null> =>
  tx("match_events", "readwrite", async (store) => {
    const index = store.index("matchId_createdAt");
    const range = IDBKeyRange.bound(
      [matchId, 0],
      [matchId, Number.MAX_SAFE_INTEGER]
    );
    return new Promise((resolve, reject) => {
      const cursorReq = index.openCursor(range, "prev"); // last by createdAt
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(null);
          return;
        }
        const value = cursor.value as StoredMatchEvent;
        const deleteReq = cursor.delete();
        deleteReq.onsuccess = () => resolve(value);
        deleteReq.onerror = () => reject(deleteReq.error);
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  });
