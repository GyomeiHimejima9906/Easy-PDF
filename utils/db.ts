
// Proxy for the DB Worker using Blob approach for robustness in all environments

// We embed the worker code to avoid bundler/URL resolution issues.
const workerCode = `
const DB_NAME = 'EasyPDF_v2_DB';
const DB_VERSION = 1;

let db = null;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
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

const calculateHash = async (data) => {
  try {
      const encoder = new TextEncoder();
      let buffer;
      if (typeof data === 'string') {
          buffer = encoder.encode(data);
      } else if (data instanceof Uint8Array) {
          buffer = data.buffer;
      } else {
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
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(payload.key);
        req.onsuccess = () => self.postMessage({ id, result: req.result?.value });
        break;
      }
      case 'SET_SETTING': {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        store.put({ key: payload.key, value: payload.value });
        tx.oncomplete = () => self.postMessage({ id, result: true });
        break;
      }
      case 'SAVE_FILE': {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
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
        const tx = db.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const req = store.getAll();
        req.onsuccess = () => {
             const sorted = (req.result || []).sort((a, b) => b.lastModified - a.lastModified);
             self.postMessage({ id, result: sorted });
        };
        break;
      }
      case 'DELETE_FILE': {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        store.delete(payload.id);
        tx.oncomplete = () => self.postMessage({ id, result: true });
        break;
      }
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
`;

let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: Function, reject: Function }>();

const getWorker = () => {
  if (!worker) {
    // Create blob from string to avoid URL path issues
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl);
    
    worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      const req = pendingRequests.get(id);
      if (req) {
        if (error) req.reject(new Error(error));
        else req.resolve(result);
        pendingRequests.delete(id);
      }
    };
    
    worker.onerror = (e) => {
        console.error("DB Worker Error:", e);
    };
  }
  return worker;
};

const sendToWorker = (type: string, payload: any = {}): Promise<any> => {
  const id = Math.random().toString(36).substr(2, 9);
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    getWorker().postMessage({ type, payload, id });
  });
};

export const DB = {
  getSetting: (key: string) => sendToWorker('GET_SETTING', { key }),
  setSetting: (key: string, value: any) => sendToWorker('SET_SETTING', { key, value }),
  saveFile: (fileData: any) => sendToWorker('SAVE_FILE', fileData),
  getFiles: () => sendToWorker('GET_FILES'),
  deleteFile: (id: string) => sendToWorker('DELETE_FILE', { id }),
};
