const limit = 10 * 1024 * 1024;

export async function validatePDF(file) {
  if (!file || file.size === 0) throw new Error("Choose a PDF document.");
  if (file.size > limit) throw new Error("Choose a PDF smaller than 10 MB.");
  if ((await file.slice(0, 5).text()) !== "%PDF-")
    throw new Error("That file is not a PDF. Choose a PDF document.");
}

export function createAssetStore(name) {
  let database;
  function openDatabase() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("pdfs");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          database = null;
          reject(new Error("Browser storage is unavailable. Please try again."));
        };
      });
    return database;
  }

  async function transact(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pdfs", mode),
        request = action(transaction.objectStore("pdfs"));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () =>
        reject(new Error("Could not save or read this PDF in browser storage."));
    });
  }

  return {
    async put(file,id=crypto.randomUUID()) {await transact('readwrite',store=>store.put(file,id));return id;},
    get:id=>transact('readonly',store=>store.get(id)),
    remove:id=>transact('readwrite',store=>store.delete(id))
  };
}
const store=createAssetStore('marmullaku-profile-attachments');
export const putPreviewAsset=(file,id)=>store.put(file,id);
export const getPDF=id=>store.get(id);
export const deletePDF=id=>store.remove(id);
