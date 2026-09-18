const DB_NAME = 'jovi-camera-captures';
const DB_VERSION = 1;
const STORE_NAME = 'captures';

function openCaptureDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB não está disponível neste navegador.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o IndexedDB.'));
  });
}

function runCaptureTransaction(mode, callback) {
  return openCaptureDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Operação de captura falhou.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Transação de captura falhou.'));
    };
  }));
}

export function saveStoredCapture(capture) {
  return runCaptureTransaction('readwrite', (store) => store.put(capture));
}

export function listStoredCaptures() {
  return runCaptureTransaction('readonly', (store) => store.getAll())
    .then((captures) => captures.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}
