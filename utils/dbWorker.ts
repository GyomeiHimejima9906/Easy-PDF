
const DB_NAME = 'EasyPDF_v2_DB';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('files')) {
        database.createObjectStore('files', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
};

const calculateHash = async (data: any): Promise<string> => {
  try {
      const encoder = new TextEncoder();
      // Handle different data types for hashing
      let buffer: ArrayBuffer;
      if (typeof data === 'string') {
          buffer = encoder.encode(data);
      } else if (data instanceof Uint8Array) {
          buffer = data.buffer;
      } else {
          // Fallback for objects
          buffer = encoder.encode(JSON.stringify(data));
      }
      
      const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
      console.error("Hash calculation failed", e);
      return "hash-error-" + Date.now();
  }
};

self.onmessage = async (e) => {
  if (!db) await initDB();
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'GET_SETTING': {
        const tx = db!.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(payload.key);
        req.onsuccess = () => self.postMessage({ id, result: req.result?.value });
        break;
      }
      case 'SET_SETTING': {
        const tx = db!.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        store.put({ key: payload.key, value: payload.value });
        tx.oncomplete = () => self.postMessage({ id, result: true });
        break;
      }
      case 'SAVE_FILE': {
        const tx = db!.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        // Integrity check: Calculate hash of the binary file
        const integrityHash = await calculateHash(payload.file);
        
        const record = { 
            ...payload, 
            hash: integrityHash, 
            lastModified: Date.now() 
        };
        
        store.put(record);
        tx.oncomplete = () => self.postMessage({ id, result: { success: true, hash: integrityHash } });
        break;
      }
      case 'GET_FILES': {
        const tx = db!.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const req = store.getAll();
        req.onsuccess = () => {
             // Sort by lastModified desc
             const sorted = (req.result || []).sort((a: any, b: any) => b.lastModified - a.lastModified);
             self.postMessage({ id, result: sorted });
        };
        break;
      }
      case 'DELETE_FILE': {
        const tx = db!.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        store.delete(payload.id);
        tx.oncomplete = () => self.postMessage({ id, result: true });
        break;
      }
    }
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message });
  }
};
