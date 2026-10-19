// Optional browser regression: serve this repository, then run with Playwright Firefox installed.
import assert from 'node:assert/strict';
const {firefox}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await firefox.launch({headless:true,...(process.env.FIREFOX_EXECUTABLE?{executablePath:process.env.FIREFOX_EXECUTABLE}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:8000';
try{
 const page=await browser.newPage({viewport:{width:1920,height:1000}});
 await page.goto(base);
 await page.setContent(`<html data-live="true"><head><link rel="stylesheet" href="${base}/profile/editor.css"><link rel="stylesheet" href="${base}/main/profile-live.css"></head><body>
 <button id="focus-origin">Edit</button><button id="undo-row" hidden>Undo</button><input id="row-logo" type="file"><p id="resume-status"></p>
 <dialog id="resume" open><div class="resume-workspace"><article class="paper"><header class="paper-header"><div><h2 id="resume-name">Test profile</h2></div></header><div class="resume-sections"><div class="resume-column"><img class="cv-portrait" alt=""></div><div class="resume-column"><section class="resume-section" data-section="experience" data-field="experience"><div class="section-heading"><h3>Experience</h3></div></section></div></div><div class="paper-foot">example.test <span></span></div></article></div></dialog></body></html>`);
 await page.evaluate(async base=>{
  const {setupCVPagination}=await import(base+'/profile/cv-pagination.mjs');
  const {createRowEditor}=await import(base+'/profile/cv-row-editor.mjs');
  const {rowLayouts}=await import(base+'/profile/cv-rows.mjs');
  for(const name of Object.keys(rowLayouts)){
   if(name==='experience')continue;
   const section=document.createElement('section');section.className='resume-section';section.dataset.section=section.dataset.field=name;section.innerHTML=`<div class="section-heading"><h3>${name}</h3></div>`;
   document.querySelector('.resume-column').append(section);
  }
  let pagination;
  const rows=Object.fromEntries(Object.keys(rowLayouts).map(field=>[field,[]]));
  rows.experience=Array.from({length:12},(_,i)=>({id:crypto.randomUUID(),date:'2020–2024',title:`Role ${i+1}`,detail:'Example company',body:'A complete entry with meaningful work. '.repeat(6)}));
  rows.experience[1].href='https://example.com';
  window.expectedIDs=rows.experience.map(row=>row.id);
  window.rowEditor=createRowEditor({rows,isReadOnly:()=>false,beforeEdit:()=>{},attachPDF:()=>{},beforeRender:()=>pagination?.restore(),onChange:()=>pagination?.schedule()});
  const attachment=document.createElement('div');attachment.className='document-attachments';attachment.innerHTML='<div class="document-attachment"><button class="document-link" aria-label="Example attachment">PDF</button></div>';
  document.querySelector('.cv-cell-title').append(attachment);
  pagination=setupCVPagination(document.querySelector('.paper'));window.pagination=pagination;pagination.layout();
 },base);
 const inspect=()=>page.evaluate(()=>({ids:[...document.querySelectorAll('.cv-row')].map(row=>row.dataset.rowId),pages:document.querySelectorAll('.cv-page').length,expected:window.expectedIDs,overflows:[...document.querySelectorAll('.cv-page')].some(page=>[...page.querySelectorAll('.cv-row')].some(row=>row.getBoundingClientRect().bottom>page.querySelector('.paper-foot').getBoundingClientRect().top))}));
 let result=await inspect();assert(result.pages>1);assert.deepEqual(result.ids,result.expected);assert.equal(result.overflows,false);
 const offsets=await page.locator('[data-section=experience] .cv-row').evaluateAll(rows=>rows.map(row=>row.querySelector('.cv-cell-title > .cv-row-text').getBoundingClientRect().top-row.getBoundingClientRect().top));
 assert(offsets.every(offset=>Math.abs(offset)<1),'attachment controls must not move a title off the row baseline');
 await page.getByRole('button',{name:'Edit title for experience row 8',exact:true}).click();
 await page.locator('[contenteditable="plaintext-only"]').fill('Changed role');await page.locator('[contenteditable="plaintext-only"]').press('Enter');
 await page.waitForTimeout(100);assert.equal(await page.getByText('Changed role',{exact:true}).count(),1);
 for(let i=0;i<3;i++)await page.evaluate(()=>window.pagination.layout());
 result=await inspect();assert.deepEqual(result.ids,result.expected);assert.equal(result.overflows,false);
 await page.evaluate(()=>{window.pagination.restore();window.pagination.layout();});assert.deepEqual((await inspect()).ids,result.expected);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert.deepEqual((await inspect()).ids,result.expected);assert.equal((await inspect()).overflows,false);
 console.log('PASS: live A4 pagination preserves entry order and editing across repeated layouts and mobile resize');
}finally{await browser.close();}
