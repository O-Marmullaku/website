import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const origin='http://localhost:8000';
const tick=()=>new Promise(setImmediate);
function fixture(){
  const events={},elements=[],closeEvents=[],updates=[];
  function element(){
    const classes=new Set(),handlers={};
    return {
      contentWindow:{},contentDocument:{querySelector:()=>null},
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(){},contains:c=>classes.has(c)},
      setAttribute(){},removeAttribute(){},append(){},focus(){},
      addEventListener(name,fn){handlers[name]=fn;},
      fire(name,event={}){handlers[name]?.({preventDefault(){},...event});},
      remove(){this.removed=true;},showModal(){this.open=true;},
      close(){this.open=false;closeEvents.push(()=>this.fire('close'));},
    };
  }
  const window={siblingSession:{active:false},MARMULLAKU_LOCAL_PREVIEW:true,requestPrivateCV(){}};
  const document={baseURI:origin+'/',activeElement:element(),body:{append(){}},querySelector:()=>element(),dispatchEvent:event=>updates.push(event),createElement:()=>{const item=element();elements.push(item);return item;}};
  let entered=0,exited=0;
  const source=readFileSync(new URL('../main/profile-bridge.js',import.meta.url),'utf8').split('\n').slice(2).join('\n');
  vm.runInNewContext(source,{
    window,document,location:{href:origin+'/',origin,hash:''},URL,URLSearchParams,CustomEvent,
    createProfileMotion:()=>({enter(){entered++;},reset(){},exit:async()=>{exited++;}}),
    addEventListener:(name,fn)=>events[name]=fn,setTimeout:()=>1,clearTimeout(){},
  });
  const send=(frame,type,data={})=>events.message({origin,source:frame.contentWindow,data:{type,...data}});
  return {window,elements,closeEvents,updates,send,panel:elements[0],get entered(){return entered;},get exited(){return exited;}};
}

test('preparing a profile leaves the homepage visible and ignores stale frames',async()=>{
  const f=fixture();await f.window.openPrivateCV(null,{id:'osman'});
  const first=f.elements.at(-1);
  assert.equal(f.panel.open,undefined);assert(f.panel.classList.contains('preparing'));
  await f.window.openPrivateCV(null,{id:'diellza'});assert(first.removed);
  f.send(first,'marmullaku-ready');assert.equal(f.entered,0);
  f.send(f.elements.at(-1),'marmullaku-ready');assert.equal(f.entered,1);
  assert.equal(f.panel.open,true);assert.equal(f.panel.classList.contains('preparing'),false);
});

test('rapidly opening three profiles keeps the last requested profile',async()=>{
  const f=fixture();await Promise.all(['osman','diellza','drilona'].map(id=>f.window.openPrivateCV(null,{id})));
  const frames=f.elements.filter(item=>item.src&&!item.removed);
  assert.equal(frames.length,1);assert.equal(new URL(frames[0].src).searchParams.get('id'),'drilona');
});

test('closing waits for the draft, and a failed save leaves the editor available',async()=>{
  const f=fixture();await f.window.openPrivateCV(null,{id:'osman'});
  const frame=f.elements.at(-1);f.send(frame,'marmullaku-ready');
  let release;
  frame.contentWindow.flushProfile=()=>new Promise(resolve=>{release=resolve;});
  f.panel.fire('cancel');await tick();
  assert.equal(frame.inert,true);assert.equal(f.exited,0);assert.equal(frame.removed,undefined);
  release(false);await tick();assert.equal(f.panel.open,true);assert.equal(frame.inert,false);
  frame.contentWindow.flushProfile=async()=>{throw new Error('Connection unavailable');};
  f.panel.fire('cancel');await tick();assert.equal(frame.removed,undefined);assert.equal(f.panel.open,true);
  frame.contentWindow.flushProfile=async()=>true;
  f.panel.fire('cancel');await tick();assert.equal(frame.removed,true);assert.equal(f.exited,1);
});

test('a queued close event cannot remove a newly requested profile',async()=>{
  const f=fixture();await f.window.openPrivateCV(null,{id:'osman'});
  const first=f.elements.at(-1);f.send(first,'marmullaku-ready');
  await f.window.openPrivateCV(null,{id:'diellza'});
  const second=f.elements.at(-1);assert(first.removed);assert.notEqual(second,first);
  f.closeEvents.shift()();assert.equal(second.removed,undefined);
  f.send(second,'marmullaku-ready');assert.equal(f.panel.open,true);
});

test('an unexpected native close still protects unsaved edits',async()=>{
  const f=fixture();await f.window.openPrivateCV(null,{id:'osman'});
  const frame=f.elements.at(-1);f.send(frame,'marmullaku-ready');frame.contentWindow.flushProfile=async()=>false;
  f.panel.open=false;f.panel.fire('close');await tick();
  assert.equal(f.panel.open,true);assert.equal(frame.removed,undefined);assert.equal(f.exited,0);
});

test('saving publishes the public role update used by language switching',async()=>{
  const f=fixture();await f.window.openPrivateCV(null,{id:'osman'});
  f.send(f.elements.at(-1),'marmullaku-saved',{id:'osman',role:'Updated title'});
  assert.equal(f.updates[0].type,'marmullaku-profile-updated');assert.equal(f.updates[0].detail.role,'Updated title');
});
