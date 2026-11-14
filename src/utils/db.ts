import type { AlbumItem } from '../types/album';

const DB_NAME = 'album3d_db';
const DB_VERSION = 4;
const STORE_NAME = 'items';

/** In-memory fallback when IndexedDB is unavailable (e.g. private/restricted environments) */
const memoryStore = new Map<string, AlbumItem>();

function isValidShowcaseItem(item: AlbumItem | undefined | null): item is AlbumItem {
  return Boolean(
    item &&
      item.id &&
      Array.isArray(item.views) &&
      item.views.length === 9 &&
      typeof item.views[0]?.dataUrl === 'string' &&
      item.views[0].dataUrl.length > 0,
  );
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Upgrade to v4 so seeded demo items refresh to high-resolution 9-angle transparent PNG sets
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open error'));
  });
}

export async function dbGetAllItems(): Promise<AlbumItem[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryStore.values())
      .filter(isValidShowcaseItem)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const db = await openDatabase();
    return await new Promise<AlbumItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = ((req.result as AlbumItem[] | undefined) ?? []).filter(isValidShowcaseItem);
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll error'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return Array.from(memoryStore.values())
      .filter(isValidShowcaseItem)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function dbPutItem(item: AlbumItem): Promise<void> {
  memoryStore.set(item.id, item);
  if (!hasIndexedDB()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB put error'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Kept in memoryStore fallback
  }
}

export async function dbPutManyItems(items: AlbumItem[]): Promise<void> {
  for (const item of items) {
    memoryStore.set(item.id, item);
  }
  if (!hasIndexedDB()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB batch put error'));
      };
    });
  } catch {
    // Kept in memoryStore fallback
  }
}

export async function dbDeleteItem(id: string): Promise<void> {
  memoryStore.delete(id);
  if (!hasIndexedDB()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB delete error'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Removed from memoryStore fallback
  }
}
