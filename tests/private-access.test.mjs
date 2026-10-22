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
    family: [], assets: [], activity: [], storage: new Map(),
  };
  const fetcher = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/storage/v1/object/')) {
      const path=parsed.pathname.replace('/storage/v1/object/authenticated/','/storage/v1/object/');
      if (options.method==='POST') {state.storage.set(path,options.body);return new Response('{}');}
      return state.storage.has(path)?new Response(state.storage.get(path)):new Response('',{status:404});
    }
    const body = options.body ? JSON.parse(options.body) : null;
    const json = (v, status = 200) => new Response(JSON.stringify(v), {status});
    if (parsed.pathname === '/auth/v1/otp') { state.deliveries++; return json({}); }
    if (parsed.pathname === '/auth/v1/user') {
      const id = ({'Bearer owner-token': 'owner-a', 'Bearer other-token': 'owner-b', 'Bearer stranger-token': 'outsider'})[options.headers.Authorization];
      return id ? json({id}) : json({}, 401);
    }
    const table = parsed.pathname.endsWith('marmullaku_profiles') ? 'profiles' : parsed.pathname.endsWith('marmullaku_family')?'family':parsed.pathname.endsWith('marmullaku_assets')?'assets':parsed.pathname.endsWith('marmullaku_activity')?'activity':'links';
    if (parsed.pathname.endsWith('marmullaku_archive_chunks')) return json([{part:0, content:JSON.stringify({'index.html':{type:'text/html',body:'private'}})}]);
    let rows = state[table].filter(row => [...parsed.searchParams].every(([k, v]) => {
      if (['select','limit','order','on_conflict'].includes(k)) return true;
      if (v === 'is.null') return row[k] == null;
      if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
      if (v.startsWith('gt.')) return row[k] > v.slice(3);
      if (v.startsWith('gte.')) return row[k] >= v.slice(4);
      if (v.startsWith('in.(')) return v.slice(4,-1).split(',').includes(String(row[k]));
      return false;
    }));
    if (options.headers.Authorization === 'Bearer owner-token') rows = rows.filter(r => table === 'profiles' ? r.owner_user_id === 'owner-a' : table==='family'?r.owner_id==='osman':table==='activity'?state.links.some(l=>l.id===r.link_id&&l.profile_id==='osman'):r.profile_id === 'osman');
    if (options.headers.Authorization === 'Bearer other-token') rows = rows.filter(r => table === 'profiles' ? r.owner_user_id === 'owner-b' : table==='family'?r.owner_id==='diellza':table==='activity'?state.links.some(l=>l.id===r.link_id&&l.profile_id==='diellza'):r.profile_id === 'diellza');
    if (options.method === 'POST') {
      if(table==='family') {const old=state.family.find(r=>r.owner_id===body.owner_id&&r.recipient_id===body.recipient_id);if(old){Object.assign(old,body);return json([old]);}}
      rows = [{...body, id: body.id||crypto.randomUUID(), revoked: false, created_at: new Date().toISOString()}]; state[table].push(...rows);
    }
    if (options.method === 'PATCH') rows.forEach(r => Object.assign(r, body));
    const cols = parsed.searchParams.get('select');
    return json(cols ? rows.map(row => Object.fromEntries(cols.split(',').map(k => [k, row[k]]))) : rows);
  };
  const handler = createHandler({url: 'https://backend.test', serviceKey: 'server-only'}, fetcher);
  const call = async (action, data = {}, headers = {}) => {
    const response = await handler(new Request('https://backend.test/functions/v1/marmullaku-access', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://marmullaku.ch', ...headers}, body: JSON.stringify({action, ...data})}));
    return {status: response.status, headers: response.headers, data: response.headers.get('content-type')==='application/pdf'?new Uint8Array(await response.arrayBuffer()):await response.json()};
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

test('new links are permanent, copyable only by their owner, and can be turned off',async()=>{
  const {call,state}=await fixture(),owner={authorization:'Bearer owner-token'};
  const created=await call('create',{company:'Small business'},owner),id=created.data.link.id;
  assert.equal(created.data.link.expires_at,null);
  assert(!JSON.stringify(created.data).includes('encrypted_token'));
  assert.notEqual(state.links.at(-1).encrypted_token,created.data.token);
  assert.equal((await call('copy-link',{id},owner)).data.token,created.data.token);
  assert.equal((await call('copy-link',{id},{authorization:'Bearer other-token'})).status,404);
  const guest={'x-cv-access':created.data.token};
  assert.equal((await call('read',{},guest)).status,200);
  await call('toggle-link',{id,revoked:true},owner);
  assert.equal((await call('read',{},guest)).status,404);
  assert.equal((await call('copy-link',{id},owner)).status,404);
  await call('toggle-link',{id,revoked:false},owner);
  assert.equal((await call('read',{},guest)).status,200);
});

test('family owners control access through another sibling account and company link',async()=>{
  const {call,state}=await fixture(),owner={authorization:'Bearer owner-token'},sibling={authorization:'Bearer other-token'},guest={'x-cv-access':token};
  assert.equal((await call('read',{profile_id:'diellza'},guest)).status,404);
  assert.equal((await call('read-profile',{profile_id:'diellza'},owner)).status,403);
  await call('share-family',{owner_id:'diellza',recipient_id:'ali',enabled:true},owner);
  assert.equal(state.family[0].owner_id,'osman');
  await call('share-family',{recipient_id:'osman',enabled:true},sibling);
  assert.equal((await call('read',{profile_id:'diellza'},guest)).status,200);
  assert.equal((await call('read-profile',{profile_id:'diellza'},owner)).data.editable,false);
  assert.equal((await call('welcome',{},guest)).data.profiles.length,2);
  await call('share-family',{recipient_id:'osman',enabled:false},sibling);
  assert.equal((await call('read',{profile_id:'diellza'},guest)).status,404);
  assert.equal((await call('read-profile',{profile_id:'diellza'},owner)).status,403);
});

const editor=()=>({version:1,rows:Object.fromEntries(['contact','skills','languages','experience','education','certificates','interests'].map(key=>[key,[]])),data:{},extraTypes:[],documents:[],picture_id:null,pictureAnchor:null});
test('uploads validate bytes; links read only attached private files and stop after revocation',async()=>{
  const {call,state}=await fixture(),owner={authorization:'Bearer owner-token'},guest={'x-cv-access':token};
  assert.equal((await call('upload',{name:'fake.pdf',mime:'application/pdf',base64:btoa('<html>')},owner)).status,400);
  const bytes='%PDF-1.7\nSYNTHETIC FIXTURE',upload=await call('upload',{name:'Reference.pdf',mime:'application/pdf',base64:btoa(bytes)},owner),id=upload.data.id;
  assert.equal(upload.status,200);
  assert.equal((await call('asset',{id},guest)).status,404);
  const content=editor();content.documents=[{id,name:'Reference.pdf',anchor:null}];
  assert.equal((await call('save',{role:'Developer',cv:{...blank,editor:content}},owner)).status,200);
  const file=await call('asset',{id},guest);assert.equal(file.status,200);assert.equal(new TextDecoder().decode(file.data),bytes);
  assert.match(file.headers.get('cache-control'),/no-store/);
  assert.equal((await call('asset',{id},{authorization:'Bearer other-token'})).status,404);
  state.links[0].revoked=true;assert.equal((await call('asset',{id},guest)).status,404);
  state.assets[0].path='osman/../../other-app/secret.pdf';
  assert.equal((await call('asset',{id},owner)).status,404);
});

test('editor saves enforce versions, file ownership, names and server-derived activity labels',async()=>{
  const {call,state}=await fixture(),owner={authorization:'Bearer owner-token'},guest={'x-cv-access':token};
  state.profiles[0].updated_at='2026-10-15T12:00:00.000Z';
  assert.equal((await call('save',{role:'',cv:blank,updated_at:'old'},owner)).status,409);
  const invalid=editor();invalid.picture_id=crypto.randomUUID();
  assert.equal((await call('save',{role:'',cv:{...blank,editor:invalid}},owner)).status,400);
  const content=editor();content.extraTypes=['link'];content.data={linkURL:'https://example.com',linkLabel:'Portfolio'};
  assert.equal((await call('save',{display_name:'Changed',role:'Developer',cv:{...blank,editor:content},updated_at:state.profiles[0].updated_at},owner)).status,200);
  assert.equal(state.profiles[0].display_name,'Osman Marmullaku');
  await call('event',{kind:'link',label:'Invented label'},guest);
  assert.equal(state.activity.at(-1).label,'Opened Portfolio');
  assert.equal((await call('links',{},owner)).data.events.length,1);
  assert.equal((await call('links',{},{authorization:'Bearer other-token'})).data.events.length,0);
  content.data.linkURL='javascript:alert(1)';assert.throws(()=>validateCV({...blank,editor:content}));
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
