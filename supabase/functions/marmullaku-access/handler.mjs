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
  const period = x => ({when: text(x.when, 100), title: text(x.title, 200), org: text(x.org, 200)});
  return {
    contact: list(d.contact, 12, x => {
      const label = text(x[0], 200), href = text(x[1] || '', 500);
      if (href && !/^(https?:\/\/|mailto:|tel:)/i.test(href)) throw new Error('Invalid contact link');
      return [label, href];
    }),
    skills: list(d.skills, 30, x => {
      if (!Number.isFinite(x[1]) || x[1] < 0 || x[1] > 100) throw new Error('Invalid proficiency');
      return [text(x[0], 100), x[1]];
    }),
    languages: list(d.languages, 12, x => [text(x[0], 80), text(x[1], 100)]),
    profile: text(d.profile, 4000),
    experience: list(d.experience, 20, x => ({...period(x), tags: list(x.tags || [], 20, y => text(y, 80)), points: list(x.points, 20, y => text(y, 1000)), demos: []})),
    education: list(d.education, 20, period), certs: list(d.certs, 20, period), interests: text(d.interests, 2000)
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
    const db = async (path, {method = 'GET', body, jwt} = {}) => {
      const r = await fetcher(`${url}/rest/v1/${path}`, {method, headers: {apikey: serviceKey, Authorization: `Bearer ${jwt || serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation'}, body: body === undefined ? undefined : JSON.stringify(body)});
      if (!r.ok) throw new Error('Database unavailable');
      return r.status === 204 ? [] : r.json();
    };
    try {
      if (!req.headers.get('content-type')?.includes('application/json')) return reply({error: 'JSON required'}, 415);
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 131072) return reply({error: 'Request too large'}, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return reply({error: 'Invalid request'}, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({error: 'Invalid request'}, 400);
      const {action} = body;
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
      if (action === 'welcome' || action === 'read') {
        const token = req.headers.get('x-cv-access') || '';
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return reply({error: 'This link is unavailable.'}, 404);
        const tokenHash = await hashToken(token);
        const links = await db(`marmullaku_links?token_hash=eq.${tokenHash}&revoked=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=profile_id,company,message&limit=1`);
        const link = links[0];
        if (!link) return reply({error: 'This link is unavailable.'}, 404);
        const rows = await db(`marmullaku_profiles?id=eq.${link.profile_id}&select=id,display_name,role${action === 'read' ? ',cv' : ''}&limit=1`);
        if (!rows[0]) return reply({error: 'This link is unavailable.'}, 404);
        return reply({profile: rows[0], company: link.company, message: link.message});
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
      if (!profile || !ids.has(profile.id)) return reply({error: 'This account does not have sibling access.'}, 403);
      if (action === 'profile') return reply({profile});
      if (action === 'save') {
        let update;
        try { update = {display_name: text(body.display_name, 100, true), role: text(body.role, 160), cv: validateCV(body.cv), updated_at: new Date().toISOString()}; }
        catch (e) { return reply({error: e.message}, 400); }
        const rows = await db(`marmullaku_profiles?id=eq.${profile.id}`, {method: 'PATCH', body: update, jwt});
        if (!rows[0]) return reply({error: 'Could not save your CV.'}, 409);
        return reply({profile: {...rows[0], owner_user_id: undefined}});
      }
      if (action === 'links') return reply({links: await db(`marmullaku_links?profile_id=eq.${profile.id}&select=id,company,message,created_at,expires_at,revoked&order=created_at.desc&limit=100`, {jwt})});
      if (action === 'create') {
        let company, message, days;
        try {
          company = text(body.company, 120, true); message = text(body.message || '', 300);
          days = Number(body.days);
          if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Choose an expiry between 1 and 365 days.');
        } catch (e) { return reply({error: e.message}, 400); }
        const token = newToken();
        const rows = await db('marmullaku_links', {method: 'POST', jwt, body: {profile_id: profile.id, token_hash: await hashToken(token), company, message, expires_at: new Date(Date.now() + days * 86400000).toISOString()}});
        const link = rows[0];
        if (!link) return reply({error: 'Could not create a link.'}, 409);
        return reply({token, link: {id: link.id, company: link.company, message: link.message, expires_at: link.expires_at, revoked: link.revoked, created_at: link.created_at}});
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
