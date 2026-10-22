import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture({member = true,refresh,storage} = {}) {
  const saved = storage||new Map(), calls = [], actions = [];
  const context = {
    window: {MARMULLAKU_BACKEND: {url:'https://backend.test',publishableKey:'public-test-key'}, marmullakuRequest:async action=>{actions.push(action);if(!member)throw Object.assign(new Error('No sibling access'),{status:403});return {profile:{id:'osman'}};}},
    sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
    fetch:async(url,options)=>{
      calls.push({url,...options});
      if(refresh&&url.includes('grant_type=refresh_token'))return refresh();
      return {ok:true,json:async()=>url.endsWith('/user')?{id:'owner'}:{access_token:'test-session',refresh_token:'test-refresh',expires_in:3600}};
    }, Date,
  };
  vm.runInNewContext(readFileSync(new URL('../admin/session.js',import.meta.url),'utf8'),context);
  return {session:context.window.siblingSession,calls,actions,saved};
}
test('password sign-in uses the password grant and checks sibling access before success',async()=>{
  const {session,calls,actions,saved}=fixture();
  await session.signIn('owner@example.invalid','Synthetic test password');
  assert(calls[0].url.endsWith('/token?grant_type=password'));
  assert.deepEqual(JSON.parse(calls[0].body),{email:'owner@example.invalid',password:'Synthetic test password'});
  assert.deepEqual(actions,['profile']); assert.equal(session.active,true);
  assert(![...saved.values()].join('').includes('Synthetic test password'));
});

test('parallel requests share a single session refresh',async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const {session,calls,saved}=fixture({refresh:()=>pending});
  saved.set('marmullaku-sibling-session',JSON.stringify({access_token:'expired-test-session',refresh_token:'test-refresh',expires_at:0}));
  const requests=[session.request('links'),session.request('family')];
  release({ok:true,json:async()=>({access_token:'fresh-test-session',refresh_token:'fresh-test-refresh',expires_in:3600})});
  await Promise.all(requests);
  assert.equal(calls.filter(call=>call.url.includes('grant_type=refresh_token')).length,1);
  assert.equal(JSON.parse(saved.get('marmullaku-sibling-session')).access_token,'fresh-test-session');
});

test('a temporary refresh failure preserves the session for a retry',async()=>{
  let available=false;
  const f=fixture({refresh:async()=>{
    if(!available)throw new Error('Network unavailable');
    return {ok:true,json:async()=>({access_token:'fresh-test-session',refresh_token:'fresh-test-refresh',expires_in:3600})};
  }});
  const expired=JSON.stringify({access_token:'expired-test-session',refresh_token:'test-refresh',expires_at:0});
  f.saved.set('marmullaku-sibling-session',expired);
  await assert.rejects(f.session.request('profile'),/Network unavailable/);
  assert.equal(f.saved.get('marmullaku-sibling-session'),expired);
  available=true;await f.session.request('profile');assert.equal(f.session.active,true);
});

test('a late refresh cannot undo sign-out or overwrite a newer iframe session',async()=>{
  for(const replacement of [null,{access_token:'iframe-session',refresh_token:'iframe-refresh',expires_at:Date.now()+3600000}]){
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    const f=fixture({refresh:()=>pending});
    f.saved.set('marmullaku-sibling-session',JSON.stringify({access_token:'expired-test-session',refresh_token:'test-refresh',expires_at:0}));
    const request=f.session.request('profile');
    if(replacement)f.saved.set('marmullaku-sibling-session',JSON.stringify(replacement));else await f.session.signOut();
    release({ok:true,json:async()=>({access_token:'late-test-session',refresh_token:'late-test-refresh',expires_in:3600})});
    if(replacement){await request;assert.deepEqual(JSON.parse(f.saved.get('marmullaku-sibling-session')),replacement);}
    else {await assert.rejects(request,error=>error.status===401);assert.equal(f.saved.size,0);}
  }
});

test('an invalid refresh token clears the expired session, even with a malformed error body',async()=>{
  for(const json of [async()=>({message:'Refresh token unavailable'}),async()=>{throw new SyntaxError('Invalid JSON');}]){
    const f=fixture({refresh:async()=>({ok:false,status:400,json})});
    f.saved.set('marmullaku-sibling-session',JSON.stringify({access_token:'expired-test-session',refresh_token:'test-refresh',expires_at:0}));
    await assert.rejects(f.session.request('profile'),error=>error.status===401);
    assert.equal(f.saved.size,0);
  }
});
test('an unrelated shared account is signed out of this session and receives no app access',async()=>{
  const {session,calls,saved}=fixture({member:false});
  await assert.rejects(session.signIn('stranger@example.invalid','Synthetic test password'),/No sibling access/);
  assert.equal(session.active,false); assert.equal(saved.size,0);
  assert(calls.at(-1).url.endsWith('/logout?scope=local'));
});
test('password setup requires a verified session and app membership; uses authenticated PUT',async()=>{
  const {session,calls,actions,saved}=fixture();
  await assert.rejects(session.setPassword('New synthetic password'),/Please sign in/);
  assert.equal(calls.length,0);
  await session.verify('owner@example.invalid','123456');
  await session.setPassword('New synthetic password');
  assert.equal(calls.at(-1).method,'PUT');
  assert.equal(calls.at(-1).headers.Authorization,'Bearer test-session');
  assert.deepEqual(JSON.parse(calls.at(-1).body),{password:'New synthetic password'});
  assert.deepEqual(actions,['profile','profile']);
  assert(![...saved.values()].join('').includes('123456'));
  assert(![...saved.values()].join('').includes('New synthetic password'));
});
test('homepage has a corner sign-in dialog and admin has no standalone login form',()=>{
  const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const admin=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
  assert.match(home,/id="sign-in-trigger">Sign in<\/button>/);
  assert.match(home,/id="sign-in-title">Sign in<\/h2>/);
  assert.match(home,/type="password" autocomplete="current-password"/);
  assert(!home.includes('Sibling sign-in')); assert(!admin.includes('id="email-form"'));
});
