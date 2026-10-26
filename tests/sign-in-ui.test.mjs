import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(overrides={}) {
  const elements=new Map(),events=[];
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,disabled:false,textContent:'',listeners:{},setAttribute(){},focus(){},reset(){},showModal(){this.open=true;},close(){const open=this.open;this.open=false;if(open)this.listeners.close?.();},addEventListener(type,fn){this.listeners[type]=fn;}});return elements.get(id);};
  const session={active:false,async sendCode(){},async verify(){},async signIn(){throw new Error('Incorrect email or password.');},...overrides};
  const context={window:{siblingSession:session},document:{getElementById:el,querySelector(){return null;}},location:{search:''},URLSearchParams,addEventListener(){},dispatchEvent:event=>events.push(event.type),Event};
  vm.runInNewContext(readFileSync(new URL('../main/sign-in.js',import.meta.url),'utf8'),context);
  return {el,events,open:context.window.showSignIn,submit:()=>el('sign-in-form').listeners.submit({preventDefault(){}})};
}
test('password setup lets you change the email without losing it',async()=>{
  const {el,open,submit}=fixture();await open();el('sign-in-setup').listeners.click();el('sign-in-email').value='preview@example.invalid';await submit();
  assert.equal(el('sign-in-back').textContent,'Change email');assert.equal(el('sign-in-email').disabled,true);
  el('sign-in-back').listeners.click();assert.equal(el('sign-in-email').disabled,false);assert.equal(el('sign-in-email').value,'preview@example.invalid');assert.equal(el('sign-in-submit').textContent,'Send code');
});
test('sign-in shows pending state and restores its action after failure',async()=>{
  let reject;const {el,open,submit}=fixture({signIn:()=>new Promise((resolve,no)=>{reject=no;})});await open();const pending=submit();
  assert.equal(el('sign-in-submit').textContent,'Signing in…');assert.equal(el('sign-in-submit').disabled,true);
  reject(new Error('Incorrect email or password.'));await pending;assert.equal(el('sign-in-submit').textContent,'Sign in');assert.equal(el('sign-in-submit').disabled,false);assert.equal(el('sign-in-status').textContent,'Incorrect email or password.');
});
test('password entry describes only this site’s password requirements',async()=>{
  const {el,open,submit}=fixture();await open();el('sign-in-setup').listeners.click();await submit();await submit();
  assert.equal(el('sign-in-title').textContent,'Set your password');assert.equal(el('sign-in-help').textContent,'Use at least 8 characters.');assert.equal(el('sign-in-password').minLength,8);
});
test('admin sign-in preserves the archive destination',()=>{
  const html=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');let target;
  vm.runInNewContext(html.match(/<script>(.*?)<\/script>/s)[1],{URL,URLSearchParams,location:{href:'https://marmullaku.ch/admin/?return=legacy',search:'?return=legacy',replace:url=>{target=new URL(url);}}});
  assert.equal(target.pathname,'/');assert.equal(target.searchParams.get('return'),'legacy');assert.equal(target.searchParams.get('sign-in'),'1');
});

test('closing a pending sign-in still publishes the authenticated state',async()=>{
 let release;const f=fixture({signIn:()=>new Promise(resolve=>{release=resolve;})});await f.open();const pending=f.submit();
 f.el('sign-in-dialog').close();await f.open();assert.equal(f.el('sign-in-submit').disabled,true,'reopening cannot submit a second request');
 release();await pending;assert.deepEqual(f.events,['marmullaku-signed-in']);assert.equal(f.el('sign-in-submit').disabled,false);
});

test('draft recovery refuses a different account before notifying the editor',async()=>{
 let signedOut=false;const f=fixture({async signIn(){},async request(){return {profile:{id:'diellza'}};},async signOut(){signedOut=true;}});
 await f.open('osman');await f.submit();assert.equal(signedOut,true);assert.equal(f.el('sign-in-dialog').open,true);assert.match(f.el('sign-in-status').textContent,/account that owns this CV/);assert.deepEqual(f.events,[]);
});
