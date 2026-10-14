import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture({member = true} = {}) {
  const saved = new Map(), calls = [], actions = [];
  const context = {
    window: {MARMULLAKU_BACKEND: {url:'https://backend.test',publishableKey:'public-test-key'}, marmullakuRequest:async action=>{actions.push(action);if(!member)throw Object.assign(new Error('No sibling access'),{status:403});return {profile:{id:'osman'}};}},
    sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
    fetch:async(url,options)=>{
      calls.push({url,...options});
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
