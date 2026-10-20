const fields = new Set(['contact','skills','languages','profile','experience','education','certificates','interests']);
export const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function string(value,max=5000) {
  if (typeof value !== 'string' || value.length > max) throw new Error('Some text is too long. Shorten it and try again.');
  return value;
}
function asset(value) {if (value == null || value === '') return null; if (!uuid(value)) throw new Error('Invalid file reference.'); return value;}
function anchor(value) {
  if (value == null) return null;
  if (!fields.has(value.field)) throw new Error('Invalid attachment position.');
  return {field:value.field,rowId:asset(value.rowId),quote:string(value.quote||''),before:string(value.before||'',32),after:string(value.after||'',32)};
}
export function validateEditor(editor) {
  if (!editor || typeof editor !== 'object' || Array.isArray(editor)) throw new Error('Invalid CV editor content.');
  const rows = {};
  for (const field of fields) {
    if (field === 'profile') continue;
    if (!Array.isArray(editor.rows?.[field]) || editor.rows[field].length > 100) throw new Error('Use at most 100 rows per section.');
    const used = new Set();
    rows[field] = editor.rows[field].map(row=>{
      if (!uuid(row.id) || used.has(row.id)) throw new Error('Invalid CV row.');
      used.add(row.id);
      if (!Number.isInteger(row.level) || row.level < 0 || row.level > 5) throw new Error('Invalid language level.');
      const href=string(row.href||'',500);
      if (href && !/^(https?:\/\/|mailto:|tel:)/i.test(href)) throw new Error('Use a web, email or phone link.');
      const score=row.score??0;
      if (!Number.isFinite(score) || score<0 || score>100) throw new Error('Invalid proficiency.');
      return {id:row.id,date:string(row.date,100),title:string(row.title,1000),detail:string(row.detail,1000),body:string(row.body),level:row.level,href,score,logo_id:asset(row.logo_id)};
    });
  }
  const data = {};
  data.theme=editor.data?.theme||'navy';
  if(!['navy','blue-gray','charcoal','forest','burgundy'].includes(data.theme))throw new Error('Choose a color theme.');
  data.typography=editor.data?.typography||'classic';
  if(!['classic','compact'].includes(data.typography))throw new Error('Choose a typography style.');
  for (const key of ['fact','pictureCaption','linkLabel','buttonLabel']) data[key] = string(editor.data?.[key]||'',500);
  for (const key of ['linkURL','buttonURL']) {
    const value = string(editor.data?.[key]||'',500);
    if (value && !/^https?:\/\//i.test(value)) throw new Error('Use an http:// or https:// link.');
    data[key] = value;
  }
  if (!Array.isArray(editor.extraTypes) || editor.extraTypes.some(type=>!['picture','fact','link','button'].includes(type))) throw new Error('Invalid extra content.');
  if (!Array.isArray(editor.documents) || editor.documents.length > 100) throw new Error('Use at most 100 documents.');
  const documents = editor.documents.map(doc=>({id:asset(doc.id),name:string(doc.name,180),anchor:anchor(doc.anchor)}));
  if (documents.some(doc=>!doc.id)) throw new Error('Invalid document.');
  return {version:1,rows,data,extraTypes:[...new Set(editor.extraTypes)],picture_id:asset(editor.picture_id),pictureAnchor:anchor(editor.pictureAnchor),documents};
}
export function editorAssets(editor) {
  return [...new Set([editor.picture_id,...editor.documents.map(doc=>doc.id),...Object.values(editor.rows).flat().map(row=>row.logo_id)].filter(Boolean))];
}
export function decodeUpload(body) {
  const mime = body.mime;
  const max = mime === 'application/pdf' ? 10485760 : 1048576;
  if (typeof body.base64 !== 'string' || body.base64.length > Math.ceil(max/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw new Error('Choose a PDF up to 10 MB or an image up to 1 MB.');
  let raw; try {raw=atob(body.base64);} catch {throw new Error('Could not read this file.');}
  const bytes = Uint8Array.from(raw,c=>c.charCodeAt(0));
  const prefix = Array.from(bytes.slice(0,12));
  const ascii = new TextDecoder().decode(bytes.slice(0,12));
  const valid = mime==='application/pdf' ? ascii.startsWith('%PDF-') : mime==='image/png' ? prefix.slice(0,8).join(',')==='137,80,78,71,13,10,26,10' : mime==='image/jpeg' ? prefix[0]===255 && prefix[1]===216 && prefix[2]===255 : mime==='image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8,12)==='WEBP' : false;
  if (!valid || !bytes.length || bytes.length>max) throw new Error('Choose a valid PDF, PNG, JPEG or WebP file.');
  const name=string(body.name,180).trim();
  if (!name) throw new Error('Give this file a name.');
  return {bytes,mime,name};
}
const encode = bytes => btoa(String.fromCharCode(...bytes));
const decode = value => Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function wrappingKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode('marmullaku-link-wrap-v1:'+secret));
  return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);
}
export async function wrapToken(token,secret) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await wrappingKey(secret),new TextEncoder().encode(token)));
  return encode(iv)+'.'+encode(cipher);
}
export async function unwrapToken(value,secret) {
  if (!value) return null;
  try {const [iv,cipher]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await wrappingKey(secret),decode(cipher)));}
  catch {return null;} // A rotated server key requires a replacement link for copying; existing URLs still validate by hash.
}
