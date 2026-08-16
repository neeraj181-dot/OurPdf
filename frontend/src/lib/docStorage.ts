/**
 * Client-Side Persistence Layer for OurPDF Documents & Downloads using IndexedDB
 */

import { PDFFileItem } from "../types";

const DB_NAME = "ourpdf_documents_db";
const DB_VERSION = 1;
const STORE_ACTIVE_DOCS = "active_documents";
const STORE_DOWNLOADS = "downloaded_documents";

export interface StoredDownloadRecord {
  id: string;
  filename: string;
  fileSize: number;
  pagesCount?: number;
  downloadDate: string;
  toolUsed?: string;
  backendDocId?: number;
  blob?: Blob;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ACTIVE_DOCS)) {
        db.createObjectStore(STORE_ACTIVE_DOCS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        db.createObjectStore(STORE_DOWNLOADS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 1. ACTIVE DOCUMENTS OPERATIONS

export async function savePersistentDoc(item: PDFFileItem, backendDocId?: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ACTIVE_DOCS, "readwrite");
    const store = tx.objectStore(STORE_ACTIVE_DOCS);

    const record = {
      id: item.id,
      name: item.name,
      size: item.size,
      pagesCount: item.pagesCount,
      pageThumbnails: item.pageThumbnails,
      extractedText: item.extractedText || "",
      pageTexts: item.pageTexts || [],
      blob: item.file,
      backendDocId: backendDocId || undefined,
      updatedAt: new Date().toISOString(),
    };

    store.put(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to persist document locally in IndexedDB:", err);
  }
}

export async function getPersistentDocs(): Promise<PDFFileItem[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ACTIVE_DOCS, "readonly");
    const store = tx.objectStore(STORE_ACTIVE_DOCS);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const records = request.result || [];
        const items: PDFFileItem[] = records.map((rec: any) => {
          const file =
            rec.blob instanceof File
              ? rec.blob
              : new File([rec.blob], rec.name, {
                  type: rec.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png",
                });

          return {
            id: rec.id,
            name: rec.name,
            size: rec.size || file.size,
            pagesCount: rec.pagesCount || 1,
            pageThumbnails: rec.pageThumbnails || [],
            extractedText: rec.extractedText || "",
            pageTexts: rec.pageTexts || [],
            file,
            backendDocId: rec.backendDocId,
          };
        });
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to retrieve persistent documents from IndexedDB:", err);
    return [];
  }
}

export async function deletePersistentDoc(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ACTIVE_DOCS, "readwrite");
    const store = tx.objectStore(STORE_ACTIVE_DOCS);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to delete document from IndexedDB:", err);
  }
}

export async function updatePersistentDocBackendId(id: string, backendDocId: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ACTIVE_DOCS, "readwrite");
    const store = tx.objectStore(STORE_ACTIVE_DOCS);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.backendDocId = backendDocId;
        store.put(record);
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to update backendDocId in IndexedDB:", err);
  }
}

export async function updatePersistentDocName(id: string, newName: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_ACTIVE_DOCS, STORE_DOWNLOADS], "readwrite");
    const docStore = tx.objectStore(STORE_ACTIVE_DOCS);
    const dlStore = tx.objectStore(STORE_DOWNLOADS);

    const getReq = docStore.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        const oldName = record.name;
        record.name = newName;
        record.updatedAt = new Date().toISOString();
        if (record.blob) {
          record.blob = new File([record.blob], newName, {
            type: record.blob.type || "application/pdf",
          });
        }
        docStore.put(record);

        // Also update matching downloads
        const dlReq = dlStore.getAll();
        dlReq.onsuccess = () => {
          const dlRecords = dlReq.result || [];
          for (const dl of dlRecords) {
            if (
              (record.backendDocId && dl.backendDocId === record.backendDocId) ||
              dl.filename === oldName
            ) {
              dl.filename = newName;
              dlStore.put(dl);
            }
          }
        };
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to update document name in IndexedDB:", err);
  }
}

// 2. DOWNLOADED DOCUMENTS OPERATIONS

export async function recordDownloadedDoc(
  filename: string,
  fileSize: number,
  pagesCount = 1,
  toolUsed = "Export",
  blob?: Blob,
  backendDocId?: number
): Promise<StoredDownloadRecord> {
  const item: StoredDownloadRecord = {
    id: `dl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    filename,
    fileSize,
    pagesCount,
    downloadDate: new Date().toISOString(),
    toolUsed,
    blob,
    backendDocId,
  };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DOWNLOADS, "readwrite");
    const store = tx.objectStore(STORE_DOWNLOADS);
    store.put(item);
  } catch (err) {
    console.warn("Failed to record downloaded document:", err);
  }

  return item;
}

export async function getDownloadedDocs(): Promise<StoredDownloadRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DOWNLOADS, "readonly");
    const store = tx.objectStore(STORE_DOWNLOADS);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const records = request.result || [];
        // Sort newest first
        records.sort(
          (a: StoredDownloadRecord, b: StoredDownloadRecord) =>
            new Date(b.downloadDate).getTime() - new Date(a.downloadDate).getTime()
        );
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to retrieve downloaded documents:", err);
    return [];
  }
}

export async function deleteDownloadedDoc(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DOWNLOADS, "readwrite");
    const store = tx.objectStore(STORE_DOWNLOADS);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to delete downloaded doc record:", err);
  }
}
