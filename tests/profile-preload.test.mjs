import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {setupProfilePreload} from '../main/profile-preload.mjs';

function fixture(saveData=false){
 const events={},links=[];
 setupProfilePreload({baseURI:'https://example.test/',defaultView:{navigator:{connection:{saveData}}},head:{append:link=>links.push(link)},createElement:()=>({}),addEventListener:(type,handler)=>events[type]=handler});
 return {events,links,interest:{target:{closest:()=>({})}},other:{target:{closest:()=>null}}};
}
test('CV intent warms public interface resources once without requesting private data',()=>{
 const f=fixture();assert.equal(f.links.length,0);
 f.events.pointerover(f.other);assert.equal(f.links.length,0);
 f.events.focusin(f.interest);assert(f.links.length>0);
 assert(f.links.some(link=>link.rel==='modulepreload'&&link.href.includes('/profile/editor.js?')));
 assert(f.links.some(link=>link.as==='fetch'&&link.href.includes('/profile/editor.html?')&&link.crossOrigin==='anonymous'));
 assert(f.links.every(link=>new URL(link.href).origin==='https://example.test'&&!/invite|functions\/|asset|\.pdf(?:$|\?)/.test(link.href)));
 const count=f.links.length;f.events.pointerover(f.interest);f.events.pointerdown(f.interest);assert.equal(f.links.length,count);
});
test('data-saving connections skip speculative resources',()=>{
 const f=fixture(true);for(const event of Object.values(f.events))event(f.interest);assert.equal(f.links.length,0);
});

test('shared modules use one release URL and preloads match their consumers',()=>{
 const versions=new Map();
 for(const directory of ['main','profile','mockup'])for(const file of readdirSync(new URL('../'+directory+'/',import.meta.url)).filter(name=>/\.(?:m?js|html)$/.test(name))){
  const source=readFileSync(new URL('../'+directory+'/'+file,import.meta.url),'utf8');
  for(const match of source.matchAll(/([\w./-]+\.(?:m?js|css|html))\?v=([\w-]+)/g)){
   const name=match[1].split('/').at(-1),known=versions.get(name);
   if(known)assert.equal(match[2],known,`${name} has conflicting release URLs`);
   versions.set(name,match[2]);
  }
 }
 const f=fixture();f.events.focusin(f.interest);
 const consumers=['main/profile-loader.mjs','profile/editor.html','profile/editor.js'].map(path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')).join('\n');
 for(const link of f.links){
  const url=new URL(link.href),name=url.pathname.split('/').at(-1)+url.search;
  assert(consumers.includes(name),`preload has no matching consumer: ${name}`);
 }
});
