
export const pdfStorage = {
  dbName: 'SanctuaryDB',
  storeName: 'Manuscripts',

  init: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(pdfStorage.dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(pdfStorage.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  saveFile: async (id: string, data: ArrayBuffer): Promise<void> => {
    const db = await pdfStorage.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(pdfStorage.storeName, 'readwrite');
      const store = transaction.objectStore(pdfStorage.storeName);
      const request = store.put(data, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getFile: async (id: string): Promise<ArrayBuffer | null> => {
    const db = await pdfStorage.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(pdfStorage.storeName, 'readonly');
      const store = transaction.objectStore(pdfStorage.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};
