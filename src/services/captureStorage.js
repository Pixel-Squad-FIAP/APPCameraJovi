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

export function updateStoredCapture(id, patch) {
  return openCaptureDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    let updatedCapture = null;

    getRequest.onsuccess = () => {
      const currentCapture = getRequest.result;
      if (!currentCapture) {
        reject(new Error('Captura não encontrada para atualização.'));
        return;
      }

      updatedCapture = {
        ...currentCapture,
        ...patch
      };

      const putRequest = store.put(updatedCapture);
      putRequest.onerror = () => reject(putRequest.error || new Error('Não foi possível atualizar a captura.'));
    };

    getRequest.onerror = () => reject(getRequest.error || new Error('Não foi possível carregar a captura.'));
    transaction.oncomplete = () => {
      database.close();
      resolve(updatedCapture);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Transação de atualização falhou.'));
    };
  }));
}

export function listStoredCaptures() {
  return runCaptureTransaction('readonly', (store) => store.getAll())
    .then((captures) => captures.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}
