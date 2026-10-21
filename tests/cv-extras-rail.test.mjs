import test from 'node:test';
import assert from 'node:assert/strict';
import {setupExtrasRail,libraryDocuments} from '../main/cv-extras-rail.mjs';
function fixture({owner=false,content=false}={}){
 const old={document:globalThis.document,MutationObserver:globalThis.MutationObserver,requestAnimationFrame:globalThis.requestAnimationFrame};
 const made=[];let observer;
 const element=()=>({attributes:{},events:{},hidden:false,setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;}});
 const heading={append(){}},toolbar={querySelector(){return {};},insertBefore(){}};
 const rail={...element(),classList:{toggle(k,v){rail.empty=v;}},querySelector(sel){return sel==='.extras-heading'?heading:content?{}:null;},matches(){return !!this.open;},hidePopover(){this.open=false;this.events.toggle?.({newState:'closed'});},togglePopover(){this.open=!this.open;this.events.toggle?.({newState:this.open?'open':'closed'});}};
 globalThis.document={getElementById:()=>rail,querySelector:()=>toolbar,createElement:()=>{const el=element();made.push(el);return el;}};
 globalThis.MutationObserver=class{constructor(fn){observer=fn;}observe(){}};globalThis.requestAnimationFrame=fn=>fn();
 setupExtrasRail({editable:()=>owner,onLayout(){}});
 return {rail,button:made[0],close:made[1],setContent(v){content=v;observer();},restore(){Object.assign(globalThis,old);}};
}
test('readers see the drawer only when supporting content exists; removing it closes the drawer',()=>{
 const f=fixture();try{assert.equal(f.button.hidden,true);f.setContent(true);assert.equal(f.button.hidden,false);f.button.events.click();assert.equal(f.button.attributes['aria-expanded'],'true');f.setContent(false);assert.equal(f.rail.open,false);assert.equal(f.button.hidden,true);}finally{f.restore();}
});
test('owners manage extras in a closed drawer at every viewport size',()=>{
 const f=fixture({owner:true});try{assert.equal(f.button.hidden,false);assert.equal(f.rail.attributes.popover,'auto');assert.equal(!!f.rail.open,false);f.button.events.click();f.close.events.click();assert.equal(f.rail.open,false);assert.equal(f.button.focused,true);}finally{f.restore();}
});

test('preview omits documents already on the CV while keeping unattached files and the full editor library',()=>{
 const documents=[{id:'linked'},{id:'unattached'},{id:'missing-row'}],attached=new Set(['linked']);
 assert.deepEqual(libraryDocuments(documents,attached,true),documents.slice(1));
 assert.deepEqual(libraryDocuments(documents,new Set(),true),documents);
 assert.equal(libraryDocuments(documents,attached,false),documents);
});
