import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function fixture(fail=false){
 const events={},nodes=new Map(),calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();}});return nodes.get(id);};
 const card={querySelector:selector=>selector==='.role'?{dataset:{i18n:'osman'}}:{focus(){}}};
 const location={origin:'https://example.test',pathname:'/',hash:'#invite='+'A'.repeat(43)};
 const window={async marmullakuRequest(action,data,options){calls.push(options.token);if(fail)throw Object.assign(new Error('Unavailable'),{status:404});return {profile:{id:'osman',display_name:'Synthetic owner'},company:'Synthetic company'};}};
 const document={documentElement:{lang:'en'},querySelector:selector=>selector.startsWith('.role')?{closest:()=>card}:node(selector),querySelectorAll:()=>[card]};
 vm.runInNewContext(readFileSync(new URL('../main/private-access.js',import.meta.url),'utf8'),{window,document,location,addEventListener:(name,fn)=>events[name]=fn});
 return {window,location,events,card,calls};
}

test('opening several CV cards uses one welcome visit for the same invitation',async()=>{
 const f=fixture();await f.window.requestPrivateCV(null);await f.window.requestPrivateCV(f.card);await f.window.requestPrivateCV(f.card);assert.equal(f.calls.length,1);
 f.location.hash='#invite='+'B'.repeat(43);f.events.hashchange();await new Promise(setImmediate);assert.deepEqual(f.calls,['A'.repeat(43),'B'.repeat(43)]);
});

test('an unavailable invitation is checked again on retry',async()=>{
 const f=fixture(true);await f.window.requestPrivateCV(null);await f.window.requestPrivateCV(f.card);assert.equal(f.calls.length,2);
});
