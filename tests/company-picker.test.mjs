import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSwissCompanies} from '../mockup/company-search.mjs';

test('Swiss lookup tolerates accents and a company name entered without spaces',async t=>{
  const queries=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://lindas.admin.ch/query');queries.push(options.body.get('query'));
    return {ok:true,json:async()=>({results:{bindings:queries.length===1?[]:[{label:{value:'Walder Wyss AG'},uid:{value:'CHE144682497'},placeName:{value:'Bern'}}]}})};
  });
  const results=await searchSwissCompanies('Wälderwyss');
  assert(queries[0].includes('"walderwyss"'));
  assert(queries[1].includes('"walde"'));
  assert.equal(results[0].name,'Walder Wyss AG');
  assert.equal(results[0].domain,'Bern · CHE144682497');
});
