const allowedOrigins = new Set(['https://marmullaku.ch', 'https://www.marmullaku.ch', 'http://localhost:8000', 'http://127.0.0.1:8000']);
const ids = new Set(['osman', 'diellza', 'drilona', 'drenusha', 'dredhza', 'ali']);
const text = (v, max, required = false) => {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error('Invalid field');
  return v.trim();
};
const list = (v, max, map) => {
  if (!Array.isArray(v) || v.length > max) throw new Error('Invalid list');
  return v.map(map);
};
export function validateCV(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Invalid CV');
  const period = x => ({when: text(x.when, 100), title: text(x.title, 1000), org: text(x.org, 1000)});
  return {
    contact: list(d.contact, 100, x => {
      const label = text(x[0], 1000), href = text(x[1] || '', 500);
      if (href && !/^(https?:\/\/|mailto:|tel:)/i.test(href)) throw new Error('Invalid contact link');
      return [label, href];
    }),
    skills: list(d.skills, 100, x => {
      if (!Number.isFinite(x[1]) || x[1] < 0 || x[1] > 100) throw new Error('Invalid proficiency');
      return [text(x[0], 1000), x[1]];
    }),
    languages: list(d.languages, 100, x => [text(x[0], 1000), text(x[1], 1000)]),
    profile: text(d.profile, 5000),
    experience: list(d.experience, 100, x => ({...period(x), tags: list(x.tags || [], 20, y => text(y, 80)), points: list(x.points, 100, y => text(y, 5000)), demos: []})),
    education: list(d.education, 100, period), certs: list(d.certs, 100, period), interests: text(d.interests, 5000),
    ...(d.editor ? {editor:validateEditor(d.editor)} : {})
  };
}
export async function hashToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function newToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function createHandler({url, serviceKey}, fetcher = fetch) {
  return async req => {
    const origin = req.headers.get('origin');
    const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin'};
    if (origin && allowedOrigins.has(origin)) Object.assign(headers, {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cv-access', 'Access-Control-Allow-Methods': 'POST, OPTIONS'});
    const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
    if (origin && !allowedOrigins.has(origin)) return reply({error: 'Origin not allowed'}, 403);
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (req.method !== 'POST') return reply({error: 'POST required'}, 405);
    if (!url || !serviceKey) return reply({error: 'Service unavailable'}, 503);
    const db = async (path, {method = 'GET', body, jwt, merge=false} = {}) => {
      const r = await fetcher(`${url}/rest/v1/${path}`, {method, headers: {apikey: serviceKey, Authorization: `Bearer ${jwt || serviceKey}`, 'Content-Type': 'application/json', Prefer: (merge?'resolution=merge-duplicates,':'')+'return=representation'}, body: body === undefined ? undefined : JSON.stringify(body)});
      if (!r.ok) throw new Error('Database unavailable');
      return r.status === 204 ? [] : r.json();
    };
    const eligible = async sender => [sender,...(await db(`marmullaku_family?recipient_id=eq.${sender}&enabled=eq.true&select=owner_id`)).map(row=>row.owner_id).filter(id=>ids.has(id))];
    const linked = async () => {
      const token=req.headers.get('x-cv-access')||'';
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const rows=await db(`marmullaku_links?token_hash=eq.${await hashToken(token)}&revoked=eq.false&select=id,profile_id,company,message,expires_at&limit=1`);
      const link=rows[0];
      return link && (!link.expires_at || Date.parse(link.expires_at)>Date.now()) ? link : null;
    };
    const activity = async (link, profileId, kind, label) => {
      const recent=await db(`marmullaku_activity?link_id=eq.${link.id}&created_at=gte.${encodeURIComponent(new Date(Date.now()-60000).toISOString())}&select=id&limit=60`);
      if (recent.length<60) await db('marmullaku_activity',{method:'POST',body:{link_id:link.id,profile_id:profileId,kind,label:label.slice(0,250)}});
    };
    const assetResponse = async (body,allowed,link=null,ownerId=null) => {
      if (!uuid(body.id)) return reply({error:'File unavailable.'},404);
      const rows=await db(`marmullaku_assets?id=eq.${body.id}&deleted_at=is.null&select=id,profile_id,path,name,mime&limit=1`);
      const file=rows[0];
      if (!file || !allowed.includes(file.profile_id)) return reply({error:'File unavailable.'},404);
      const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.mime];
      if (!ext || file.path!==`${file.profile_id}/${file.id}.${ext}`) return reply({error:'File unavailable.'},404);
      // A company link can read only files actually attached to that CV.
      if (link || file.profile_id!==ownerId) {
        const [p]=await db(`marmullaku_profiles?id=eq.${file.profile_id}&select=cv&limit=1`);
        if (!p?.cv.editor || !editorAssets(p.cv.editor).includes(file.id)) return reply({error:'File unavailable.'},404);
      }
      const response=await fetcher(`${url}/storage/v1/object/authenticated/marmullaku-private/${file.path}`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}});
      if (!response.ok) return reply({error:'File unavailable.'},404);
      if (link && file.mime==='application/pdf') await activity(link,file.profile_id,'document',`Opened PDF: ${file.name}`);
      return new Response(await response.arrayBuffer(),{headers:{...headers,'Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="document.${file.mime==='application/pdf'?'pdf':'image'}"`}});
    };
    try {
      if (!req.headers.get('content-type')?.includes('application/json')) return reply({error: 'JSON required'}, 415);
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 14100000) return reply({error: 'Request too large'}, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return reply({error: 'Invalid request'}, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({error: 'Invalid request'}, 400);
      const {action} = body;
      if (action !== 'upload' && new TextEncoder().encode(raw).length > 524288) return reply({error:'Request too large'},413);
      if (action === 'sign-in-code') {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({error: 'Enter a valid email address.'}, 400);
        const invited = await db(`marmullaku_profiles?invite_email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
        if (invited.length) {
          const sent = await fetcher(`${url}/auth/v1/otp`, {method: 'POST', headers: {apikey: serviceKey, 'Content-Type': 'application/json'}, body: JSON.stringify({email, create_user: true, data: {app: 'marmullaku'}})});
          if (!sent.ok) return reply({error: sent.status === 429 ? 'Please wait before requesting another code.' : 'Could not send a code. Please try again.'}, sent.status === 429 ? 429 : 503);
        }
        return reply({sent: true});
      }
      if (action === 'directory') {
        const rows = await db('marmullaku_profiles?select=id,display_name,role');
        return reply({profiles: rows});
      }
      if (['welcome','read','event'].includes(action) || (action==='asset' && req.headers.has('x-cv-access'))) {
        const link = await linked();
        if (!link) return reply({error: 'This link is unavailable.'}, 404);
        const allowed=await eligible(link.profile_id), target=body.profile_id||link.profile_id;
        if (!ids.has(target) || !allowed.includes(target)) return reply({error:'This CV is unavailable.'},404);
        if (action==='asset') return assetResponse(body,allowed,link);
        const rows = await db(`marmullaku_profiles?id=eq.${target}&select=id,display_name,role${action === 'read' || action==='event' ? ',cv' : ''}&limit=1`);
        if (!rows[0]) return reply({error: 'This link is unavailable.'}, 404);
        if (action==='event') {
          const kind=body.kind;
          if (!['picture','link','button'].includes(kind)) return reply({error:'Invalid activity.'},400);
          const editor=rows[0].cv.editor;
          if (!editor?.extraTypes.includes(kind==='picture'?'picture':kind)) return reply({error:'Content unavailable.'},404);
          const label=kind==='picture'?`Viewed photo: ${editor.data.pictureCaption}`:`Opened ${editor.data[kind+'Label']}`;
          await activity(link,target,kind,label);
          return reply({recorded:true});
        }
        await activity(link,target,action==='welcome'?'visit':'cv',action==='welcome'?'Opened link':`Opened ${rows[0].display_name}’s CV`);
        const directory=action==='welcome'?await db(`marmullaku_profiles?id=in.(${allowed.join(',')})&select=id,display_name,role`):undefined;
        return reply({profile: rows[0],profiles:directory,company: link.company, message: link.message});
      }
      const authorization = req.headers.get('authorization') || '';
      const jwt = authorization.match(/^Bearer (\S+)$/)?.[1];
      if (!jwt) return reply({error: 'Please sign in.'}, 401);
      const auth = await fetcher(`${url}/auth/v1/user`, {headers: {apikey: serviceKey, Authorization: `Bearer ${jwt}`}});
      if (!auth.ok) return reply({error: 'Your session has expired. Please sign in again.'}, 401);
      const user = await auth.json();
      if (!user.id) return reply({error: 'Please sign in.'}, 401);
      // Only a confirmed, explicitly invited email can claim an unassigned sibling profile.
      if (user.email_confirmed_at && user.email && !user.is_anonymous) {
        await db(`marmullaku_profiles?invite_email=eq.${encodeURIComponent(user.email.toLowerCase())}&owner_user_id=is.null`, {method: 'PATCH', body: {owner_user_id: user.id}});
      }
      const profiles = await db(`marmullaku_profiles?owner_user_id=eq.${encodeURIComponent(user.id)}&select=id,display_name,role,cv,updated_at&limit=1`, {jwt});
      const profile = profiles[0];
      if (!profile || !ids.has(profile.id)) return reply({error: 'This account doesn’t have access.'}, 403);
      if (action === 'profile') return reply({profile});
      if (action==='read-profile') {
        const target=body.profile_id||profile.id;
        if (!ids.has(target) || !(await eligible(profile.id)).includes(target)) return reply({error:'This CV has not been shared with you.'},403);
        const [shared]=await db(`marmullaku_profiles?id=eq.${target}&select=id,display_name,role,cv,updated_at&limit=1`);
        return reply({profile:shared,editable:target===profile.id});
      }
      if (action==='asset') return assetResponse(body,await eligible(profile.id),null,profile.id);
      if (action==='upload') {
        let file;try {file=decodeUpload(body);}catch(e){return reply({error:e.message},400);}
        const id=crypto.randomUUID(),ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.mime],path=`${profile.id}/${id}.${ext}`;
        const uploaded=await fetcher(`${url}/storage/v1/object/marmullaku-private/${path}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':file.mime,'x-upsert':'false'},body:file.bytes});
        if (!uploaded.ok) return reply({error:'Could not upload the file. Please try again.'},503);
        await db('marmullaku_assets',{method:'POST',body:{id,profile_id:profile.id,path,name:file.name,mime:file.mime,bytes:file.bytes.length}});
        return reply({id,name:file.name});
      }
      if (action==='remove-file') {
        if (!uuid(body.id)) return reply({error:'Invalid file.'},400);
        const rows=await db(`marmullaku_assets?id=eq.${body.id}&profile_id=eq.${profile.id}`,{method:'PATCH',jwt,body:{deleted_at:new Date().toISOString()}});
        return rows.length?reply({removed:true}):reply({error:'File not found.'},404);
      }
      if (action==='family') {
        const family=await db(`marmullaku_family?owner_id=eq.${profile.id}&select=recipient_id,enabled`,{jwt});
        const incoming=await eligible(profile.id);
        return reply({family,profiles:await db(`marmullaku_profiles?select=id,display_name,role`),available:incoming});
      }
      if (action==='share-family') {
        if (!ids.has(body.recipient_id) || body.recipient_id===profile.id || typeof body.enabled!=='boolean') return reply({error:'Invalid family permission.'},400);
        await db('marmullaku_family?on_conflict=owner_id,recipient_id',{method:'POST',jwt,merge:true,body:{owner_id:profile.id,recipient_id:body.recipient_id,enabled:body.enabled}});
        return reply({saved:true});
      }
      if (action === 'save') {
        let update;
        try { update = {display_name: profile.display_name, role: text(body.role, 160), cv: validateCV(body.cv), updated_at: new Date().toISOString()}; }
        catch (e) { return reply({error: e.message}, 400); }
        if (update.cv.editor) {
          for (const id of editorAssets(update.cv.editor)) {
            const files=await db(`marmullaku_assets?id=eq.${id}&profile_id=eq.${profile.id}&deleted_at=is.null&select=id&limit=1`);
            if (!files.length) return reply({error:'A file is unavailable. Remove it or upload it again.'},400);
          }
        }
        if (body.updated_at && body.updated_at!==profile.updated_at) return reply({error:'This CV changed in another tab. Reload it before editing again.'},409);
        const rows = await db(`marmullaku_profiles?id=eq.${profile.id}${body.updated_at?'&updated_at=eq.'+encodeURIComponent(body.updated_at):''}`, {method: 'PATCH', body: update, jwt});
        if (!rows[0]) return reply({error: 'Could not save your CV.'}, 409);
        return reply({profile: {...rows[0], owner_user_id: undefined}});
      }
      if (action === 'links') return reply({links: await db(`marmullaku_links?profile_id=eq.${profile.id}&select=id,company,message,created_at,expires_at,revoked&order=created_at.desc&limit=100`, {jwt}),events:await db('marmullaku_activity?select=link_id,kind,label,created_at&order=created_at.desc&limit=1000',{jwt})});
      if (action === 'create') {
        let company, message;
        try {
          company = text(body.company, 120, true); message = text(body.message || '', 300);
        } catch (e) { return reply({error: e.message}, 400); }
        const token = newToken();
        const rows = await db('marmullaku_links', {method: 'POST', jwt, body: {profile_id: profile.id, token_hash: await hashToken(token), encrypted_token:await wrapToken(token,serviceKey), company, message, expires_at:null}});
        const link = rows[0];
        if (!link) return reply({error: 'Could not create a link.'}, 409);
        return reply({token, link: {id: link.id, company: link.company, message: link.message, expires_at: link.expires_at, revoked: link.revoked, created_at: link.created_at}});
      }
      if (action==='copy-link') {
        if (!uuid(body.id)) return reply({error:'Invalid link.'},400);
        const [link]=await db(`marmullaku_links?id=eq.${body.id}&profile_id=eq.${profile.id}&revoked=eq.false&select=encrypted_token&limit=1`,{jwt});
        const token=await unwrapToken(link?.encrypted_token,serviceKey);
        return token?reply({token}):reply({error:'This older link cannot be copied. Create a replacement link.'},404);
      }
      if (action==='toggle-link') {
        if (!uuid(body.id) || typeof body.revoked!=='boolean') return reply({error:'Invalid link.'},400);
        const rows=await db(`marmullaku_links?id=eq.${body.id}&profile_id=eq.${profile.id}`,{method:'PATCH',jwt,body:{revoked:body.revoked}});
        return rows.length?reply({saved:true}):reply({error:'Link not found.'},404);
      }
      if (action === 'revoke') {
        if (!/^[a-f0-9-]{36}$/i.test(body.id || '')) return reply({error: 'Invalid link.'}, 400);
        const rows = await db(`marmullaku_links?id=eq.${body.id}&profile_id=eq.${profile.id}`, {method: 'PATCH', body: {revoked: true}, jwt});
        return rows.length ? reply({revoked: true}) : reply({error: 'Link not found.'}, 404);
      }
      if (action === 'legacy') {
        const chunks = await db('marmullaku_archive_chunks?select=part,content&order=part.asc');
        if (!chunks.length || chunks.some((c, i) => c.part !== i)) return reply({error: 'The family archive is temporarily unavailable.'}, 503);
        return reply({files: JSON.parse(chunks.map(c => c.content).join(''))});
      }
      return reply({error: 'Unknown action.'}, 400);
    } catch {
      return reply({error: 'The service is temporarily unavailable. Please try again.'}, 503);
    }
  };
}
import {validateEditor,editorAssets,decodeUpload,uuid,wrapToken,unwrapToken} from './editor.mjs';
