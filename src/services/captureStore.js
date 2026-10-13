// Persistência das capturas no IndexedDB do navegador (imagens/vídeos não cabem no localStorage).
// "captures" guarda os metadados + miniatura; "media" guarda o arquivo completo.

import { openDB } from 'idb';

const DB_NAME = 'jovi-camera';
const DB_VERSION = 1;
const CAPTURES = 'captures';
const MEDIA = 'media';

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const captures = db.createObjectStore(CAPTURES, { keyPath: 'id' });
        captures.createIndex('createdAt', 'createdAt');
        db.createObjectStore(MEDIA);
      }
    });
  }
  return dbPromise;
}

export async function listCaptures() {
  const db = await getDb();
  const items = await db.getAllFromIndex(CAPTURES, 'createdAt');
  return items.reverse();
}

export async function saveCapture(capture, mediaBlob) {
  const db = await getDb();
  const tx = db.transaction([CAPTURES, MEDIA], 'readwrite');
  await Promise.all([
    tx.objectStore(CAPTURES).put(capture),
    mediaBlob ? tx.objectStore(MEDIA).put(mediaBlob, capture.id) : Promise.resolve(),
    tx.done
  ]);
  return capture;
}

export async function updateCaptureRecord(capture) {
  const db = await getDb();
  await db.put(CAPTURES, capture);
  return capture;
}

export async function getCaptureMedia(id) {
  const db = await getDb();
  return db.get(MEDIA, id);
}

export async function deleteCaptureRecord(id) {
  const db = await getDb();
  const tx = db.transaction([CAPTURES, MEDIA], 'readwrite');
  const media = await tx.objectStore(MEDIA).get(id);
  await Promise.all([
    tx.objectStore(CAPTURES).delete(id),
    tx.objectStore(MEDIA).delete(id),
    tx.done
  ]);
  return media;
}

export async function estimateStorage() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota };
}
