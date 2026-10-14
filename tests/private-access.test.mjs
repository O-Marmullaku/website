import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHandler, hashToken, validateCV} from '../supabase/functions/marmullaku-access/handler.mjs';

const blank = {contact: [], skills: [], languages: [], profile: '', experience: [], education: [], certs: [], interests: ''};
const token = 'A'.repeat(43), otherToken = 'B'.repeat(43);
const fixture = async () => {
  const state = {
    profiles: [{id: 'osman', owner_user_id: 'owner-a', display_name: 'Osman Marmullaku', role: 'Developer', cv: {...blank, profile: 'PRIVATE CV CONTENT'}}, {id: 'diellza', owner_user_id: 'owner-b', display_name: 'Diellza Marmullaku', role: '', cv: blank}],
    links: [{id: '00000000-0000-4000-8000-000000000001', profile_id: 'osman', token_hash: await hashToken(token), company: 'Example Company', message: 'Hello', expires_at: new Date(Date.now() + 86400000).toISOString(), revoked: false}],
    deliveries: 0,
  };
  const fetcher = async (url, options = {}) => {
    const parsed = new URL(url), body = options.body ? JSON.parse(options.body) : null;
    const json = (v, status = 200) => new Response(JSON.stringify(v), {status});
    if (parsed.pathname === '/auth/v1/otp') { state.deliveries++; return json({}); }
    if (parsed.pathname === '/auth/v1/user') {
      const id = ({'Bearer owner-token': 'owner-a', 'Bearer other-token': 'owner-b', 'Bearer stranger-token': 'outsider'})[options.headers.Authorization];
      return id ? json({id}) : json({}, 401);
    }
    const table = parsed.pathname.endsWith('marmullaku_profiles') ? 'profiles' : 'links';
    if (parsed.pathname.endsWith('marmullaku_archive_chunks')) return json([{part:0, content:JSON.stringify({'index.html':{type:'text/html',body:'private'}})}]);
    let rows = state[table].filter(row => [...parsed.searchParams].every(([k, v]) => {
      if (['select','limit','order'].includes(k)) return true;
      if (v === 'is.null') return row[k] == null;
      if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
      if (v.startsWith('gt.')) return row[k] > v.slice(3);
      return false;
    }));
    if (options.headers.Authorization === 'Bearer owner-token') rows = rows.filter(r => table === 'profiles' ? r.owner_user_id === 'owner-a' : r.profile_id === 'osman');
    if (options.headers.Authorization === 'Bearer other-token') rows = rows.filter(r => table === 'profiles' ? r.owner_user_id === 'owner-b' : r.profile_id === 'diellza');
    if (options.method === 'POST') { rows = [{...body, id: crypto.randomUUID(), revoked: false, created_at: new Date().toISOString()}]; state[table].push(...rows); }
    if (options.method === 'PATCH') rows.forEach(r => Object.assign(r, body));
    const cols = parsed.searchParams.get('select');
    return json(cols ? rows.map(row => Object.fromEntries(cols.split(',').map(k => [k, row[k]]))) : rows);
  };
  const handler = createHandler({url: 'https://backend.test', serviceKey: 'server-only'}, fetcher);
  const call = async (action, data = {}, headers = {}) => {
    const response = await handler(new Request('https://backend.test/functions/v1/marmullaku-access', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://marmullaku.ch', ...headers}, body: JSON.stringify({action, ...data})}));
    return {status: response.status, headers: response.headers, data: await response.json()};
  };
  return {state, handler, call};
};
test('anonymous requests and welcome never receive CV content or link hashes', async () => {
  const {call} = await fixture();
  assert.equal((await call('read')).status, 404);
  assert.equal((await call('read', {}, {'x-cv-access': otherToken})).status, 404);
  const welcome = await call('welcome', {}, {'x-cv-access': token});
  assert.equal(welcome.data.company, 'Example Company');
  assert.equal(welcome.data.profile.cv, undefined);
  const directory = await call('directory');
  assert(!JSON.stringify(directory.data).includes('PRIVATE CV CONTENT'));
  assert(!JSON.stringify(directory.data).includes('owner_user_id'));
  const read = await call('read', {}, {'x-cv-access': token});
  assert.equal(read.data.profile.id, 'osman');
  assert.equal(read.data.profile.cv.profile, 'PRIVATE CV CONTENT');
  assert.match(read.headers.get('cache-control'), /no-store/);
  assert(!JSON.stringify(read.data).includes('token_hash'));
});
test('expiry and revocation are enforced again after a successful welcome', async () => {
  const {call, state} = await fixture();
  assert.equal((await call('welcome', {}, {'x-cv-access': token})).status, 200);
  state.links[0].revoked = true;
  assert.equal((await call('read', {}, {'x-cv-access': token})).status, 404);
  state.links[0].revoked = false; state.links[0].expires_at = '2000-01-01T00:00:00Z';
  assert.equal((await call('read', {}, {'x-cv-access': token})).status, 404);
});
test('uninvited shared accounts cannot administer CVs or read the archive', async () => {
  const {call} = await fixture();
  for (const action of ['profile','links','create','save','revoke','legacy']) {
    assert.equal((await call(action)).status, 401);
    assert.equal((await call(action, {}, {authorization: 'Bearer stranger-token'})).status, 403);
  }
  assert.equal((await call('legacy', {}, {authorization:'Bearer owner-token'})).status, 200);
});
test('owners cannot revoke another sibling link or choose another profile when creating', async () => {
  const {call, state} = await fixture();
  assert.equal((await call('revoke', {id:state.links[0].id}, {authorization:'Bearer other-token'})).status, 404);
  const created = await call('create', {profile_id:'diellza', company:'Acme', message:'', days:30}, {authorization:'Bearer owner-token'});
  assert.equal(created.status, 200); assert.match(created.data.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(state.links.at(-1).profile_id, 'osman');
  assert.equal(state.links.at(-1).token_hash, await hashToken(created.data.token));
  assert(!JSON.stringify(created.data).includes('token_hash'));
});
test('invalid content and URL schemes are rejected; saved ownership is ignored', async () => {
  assert.throws(() => validateCV({...blank, contact:[['Click','javascript:alert(1)']]}));
  assert.throws(() => validateCV({...blank, skills:[['Skill',200]]}));
  const {call, state} = await fixture();
  assert.equal((await call('save', {display_name:'Test', role:'', owner_user_id:'owner-b', cv:{...blank, profile:'Updated'}}, {authorization:'Bearer owner-token'})).status, 200);
  assert.equal(state.profiles[0].owner_user_id, 'owner-a');
  assert.equal(state.profiles[0].cv.profile, 'Updated');
});
test('escaped document does not permit stored HTML or unsafe hrefs', () => {
  const context = {window:{}}; vm.runInNewContext(readFileSync(new URL('../main/cv-safe.js', import.meta.url),'utf8'), context);
  const out = context.window.escapeDocument({...blank, profile:'<img src=x onerror="alert(1)">', contact:[['<script>','javascript:alert(1)']], skills:[['X',Infinity]]});
  assert(!out.profile.includes('<')); assert.equal(out.contact[0][1], ''); assert.equal(out.skills[0][1], 0);
});
test('signup is invitation-only and unknown addresses are not emailed', async () => {
  const {call, state} = await fixture();
  assert.equal((await call('sign-in-code', {email:'stranger@example.com'})).status, 200);
  assert.equal(state.deliveries, 0);
  state.profiles[0].invite_email = 'owner@example.com';
  assert.equal((await call('sign-in-code', {email:'owner@example.com'})).status, 200);
  assert.equal(state.deliveries, 1);
});
test('public HTML contains no CV database or private legacy assets and scripts parse', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(!html.includes('placeholderCV')); assert(!html.includes('const CV ='));
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
