import test from "node:test";
import assert from "node:assert/strict";
import { findCompanies,searchSwissCompanies } from "../main/company-search.mjs";
test("company search tolerates typos, accents and pasted domains", () => {
  assert.equal(findCompanies("Siemns")[0].name, "Siemens");
  assert.equal(findCompanies("Waldr Wys", [{name:'Walder Wyss AG',domain:'Bern'}])[0].name,'Walder Wyss AG');
  assert.equal(findCompanies("eth zurich")[0].name, "ETH Zürich");
  assert.equal(findCompanies("https://www.siemens.com")[0].name, "Siemens");
  assert.deepEqual(findCompanies("no such company xyz"), []);
});
test("previous companies are searchable without duplicate directory entries", () => {
  const recent = [
    { name: "My studio", domain: "" },
    { name: "Siemens", domain: "siemens.com" },
  ];
  assert.equal(findCompanies("my studo", recent)[0].name, "My studio");
  assert.equal(
    findCompanies("sie", recent).filter((company) => company.name === "Siemens")
      .length,
    1,
  );
});
test('Swiss lookup tolerates accents and a company name entered without spaces',async t=>{
  const queries=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://lindas.admin.ch/query');queries.push(options.body.get('query'));
    return {ok:true,json:async()=>({results:{bindings:queries.length<3?[]:[{label:{value:'Walder Wyss AG'},uid:{value:'CHE144682497'},placeName:{value:'Bern'}}]}})};
  });
  const results=await searchSwissCompanies('Wälderwyss');
  assert(queries[0].includes('"wälderwyss"'),'preserve the entered accent before trying alternate spellings');
  assert(queries[1].includes('w[aàáâäãå]ld[eèéêë]rw[yýÿ]ss'),'retry alternate accents when the exact name is unavailable');
  assert(queries[2].includes('w[aàáâäãå]ld[eèéêë]'),'the fuzzy fallback can match a name entered without spaces');
  assert.equal(results[0].name,'Walder Wyss AG');
  assert.equal(results[0].domain,'Bern · CHE144682497');
});

test('correctly accented register names use the exact spelling without a fallback',async t=>{
  const queries=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    queries.push(options.body.get('query'));
    return {ok:true,json:async()=>({results:{bindings:[{label:{value:'Zürcher Kantonalbank'}}]}})};
  });
  assert.equal((await searchSwissCompanies('Zürcher'))[0].name,'Zürcher Kantonalbank');
  assert.equal(queries.length,1);assert(queries[0].includes('"zürcher"'));
});
test('an accent-free query still finds an accented register name',async t=>{
  const queries=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    queries.push(options.body.get('query'));
    return {ok:true,json:async()=>({results:{bindings:queries.at(-1).includes('z[uùúûü]r[cç]h[eèéêë]r')?[{label:{value:'Zürcher Kantonalbank'}}]:[]}})};
  });
  assert.equal((await searchSwissCompanies('Zurcher Kantonalbank'))[0].name,'Zürcher Kantonalbank');
  assert.equal(queries.length,1,'plain input uses one accent-aware request instead of exhausting the picker timeout on an exact miss');
});
