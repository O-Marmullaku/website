import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

for (const path of ['main/profile-bridge.js','mockup/site-bridge.mjs']) {
  test(`${path}: preparation leaves the homepage visible and ignores stale frames`,async()=>{
    const events={},elements=[],timers=[];
    const element=()=>{
      const classes=new Set();
      return {contentWindow:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(){},contains:c=>classes.has(c)},setAttribute(){},removeAttribute(){},addEventListener(){},append(){},remove(){this.removed=true;},showModal(){this.open=true;},close(){this.open=false;}};
    };
    const window={siblingSession:{active:false},requestPrivateCV(){}};
    const document={baseURI:'http://localhost:8000/',activeElement:element(),body:{append(){}},querySelector:()=>element(),createElement:()=>{const el=element();elements.push(el);return el;}};
    let entered=0;
    const source=readFileSync(new URL('../'+path,import.meta.url),'utf8').split('\n').slice(2).join('\n');
    vm.runInNewContext(source,{window,document,location:{href:'http://localhost:8000/',origin:'http://localhost:8000',hash:''},URL,URLSearchParams,createProfileMotion:()=>({enter(){entered++;},reset(){},exit:async()=>{}}),addEventListener:(name,fn)=>events[name]=fn,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
    await window.openPrivateCV(null,{id:'osman'});
    const panel=elements[0],first=elements.at(-1);
    assert.equal(panel.open,undefined);
    assert.equal(panel.classList.contains('preparing'),true);
    await window.openPrivateCV(null,{id:'diellza'});
    assert.equal(first.removed,true);
    events.message({origin:locationOrigin,source:first.contentWindow,data:{type:'marmullaku-ready'}});
    assert.equal(entered,0);
    events.message({origin:locationOrigin,source:elements.at(-1).contentWindow,data:{type:'marmullaku-ready'}});
    assert.equal(panel.open,true);
    assert.equal(panel.classList.contains('preparing'),false);
    assert.equal(entered,1);
    assert.equal(source.includes('Opening…'),false);
  });
}
const locationOrigin='http://localhost:8000';
