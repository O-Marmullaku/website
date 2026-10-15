import test from 'node:test';
import assert from 'node:assert/strict';
import {collapseRedundantPDFs} from '../mockup/document-duplicates.mjs';

test('identical section and row PDFs display once beside the row without deleting files',async()=>{
  const docs=[{id:'a',name:'sample.pdf',anchor:{field:'experience'}},{id:'b',name:'sample.pdf',anchor:{field:'experience',rowId:'job'}}];
  const result=await collapseRedundantPDFs(docs,async()=>new Blob(['identical PDF bytes']));
  assert.deepEqual(result,[docs[1]]);assert.equal(docs.length,2);
});

test('same-named different files, separate jobs, and unavailable files stay distinct',async()=>{
  const docs=[{id:'a',name:'reference.pdf',anchor:{field:'experience',rowId:'one'}},{id:'b',name:'reference.pdf',anchor:{field:'experience',rowId:'two'}},{id:'c',name:'reference.pdf',anchor:{field:'experience'}},{id:'missing',name:'reference.pdf',anchor:{field:'experience'}}];
  const result=await collapseRedundantPDFs(docs,async id=>id==='missing'?null:new Blob([id==='c'?'different PDF':'identical PDF']));
  assert.deepEqual(result,docs);
});
