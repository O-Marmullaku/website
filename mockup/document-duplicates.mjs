// Keep separate documents with the same filename, and intentional links beside different jobs.
export async function collapseRedundantPDFs(documents,getFile) {
  const fingerprints=new Map();
  await Promise.all([...new Set(documents.map(doc=>doc.id))].map(async id=>{
    try {
      const file=await getFile(id);if(!file)return;
      const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      fingerprints.set(id,[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join(''));
    } catch {}
  }));
  const identity=doc=>fingerprints.get(doc.id)||doc.id;
  return documents.filter((doc,index)=>!documents.some((other,otherIndex)=>{
    if(index===otherIndex||identity(doc)!==identity(other)||doc.anchor?.field!==other.anchor?.field)return false;
    if(!doc.anchor?.rowId&&other.anchor?.rowId)return true;
    return doc.anchor?.rowId===other.anchor?.rowId&&otherIndex<index;
  }));
}
