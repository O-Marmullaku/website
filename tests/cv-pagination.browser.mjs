// Optional browser regression: serve this repository, then run with Playwright Firefox installed.
import assert from 'node:assert/strict';
const {firefox}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await firefox.launch({headless:true,...(process.env.FIREFOX_EXECUTABLE?{executablePath:process.env.FIREFOX_EXECUTABLE}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:8000';
try{
 const page=await browser.newPage({viewport:{width:1920,height:1000}});
 await page.goto(base);
 await page.setContent(`<html data-live="true"><head><link rel="stylesheet" href="${base}/profile/editor.css"><link rel="stylesheet" href="${base}/main/profile-live.css"><link rel="stylesheet" href="${base}/main/cv-paper.css"></head><body>
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
  document.querySelector('.resume-column:last-child').prepend(document.querySelector('.paper-header'));
  let pagination;
  const rows=Object.fromEntries(Object.keys(rowLayouts).map(field=>[field,[]]));
  rows.experience=Array.from({length:12},(_,i)=>({id:crypto.randomUUID(),date:'2020–2024',title:`Role ${i+1}`,detail:'Example company',body:'A complete entry with meaningful work. '.repeat(6)}));
  rows.experience[1].href='https://example.com';
  window.expectedIDs=rows.experience.map(row=>row.id);
  window.rowEditor=createRowEditor({rows,isReadOnly:()=>false,beforeEdit:()=>{},attachPDF:()=>{},beforeRender:()=>pagination?.restore(),onChange:()=>pagination?.schedule()});
  const attachment=document.createElement('div');attachment.className='document-attachments';attachment.innerHTML='<div class="document-attachment"><button class="document-link" aria-label="Example attachment"><svg aria-hidden="true" viewBox="0 0 24 24"></svg><span>Example attachment</span></button></div>';
  document.querySelector('.cv-row').append(attachment);
  pagination=setupCVPagination(document.querySelector('.paper'));window.pagination=pagination;pagination.layout();
 },base);
 const inspect=()=>page.evaluate(()=>({ids:[...document.querySelectorAll('.cv-row')].map(row=>row.dataset.rowId),pages:document.querySelectorAll('.cv-page').length,expected:window.expectedIDs,overflows:[...document.querySelectorAll('.cv-page')].some(page=>[...page.querySelectorAll('.cv-row')].some(row=>row.getBoundingClientRect().bottom>page.querySelector('.paper-foot').getBoundingClientRect().top))}));
 let result=await inspect();assert(result.pages>1);assert.deepEqual(result.ids,result.expected);assert.equal(result.overflows,false);
 const offsets=await page.locator('[data-section=experience] .cv-row').evaluateAll(rows=>rows.map(row=>row.querySelector('.cv-cell-title > .cv-row-text').getBoundingClientRect().top-row.getBoundingClientRect().top));
 assert(offsets.every(offset=>Math.abs(offset)<1),'attachment controls must not move a title off the row baseline');
 await page.getByRole('button',{name:'Edit title for experience row 8',exact:true}).click();
 await page.locator('[contenteditable="plaintext-only"]').fill('Changed role');await page.locator('[contenteditable="plaintext-only"]').press('Enter');
 await page.waitForTimeout(100);assert.equal(await page.getByText('Changed role',{exact:true}).count(),1);
 const firstTitle=page.locator('.cv-cell-title .cv-row-text').first(),originalTitle=await firstTitle.textContent();
 await firstTitle.click();assert.equal(await firstTitle.getAttribute('contenteditable'),'plaintext-only');await firstTitle.fill('Cancelled edit');await firstTitle.press('Escape');assert.equal(await firstTitle.textContent(),originalTitle);
 for(let i=0;i<3;i++)await page.evaluate(()=>window.pagination.layout());
 result=await inspect();assert.deepEqual(result.ids,result.expected);assert.equal(result.overflows,false);
 await page.evaluate(()=>{window.pagination.restore();window.pagination.layout();});assert.deepEqual((await inspect()).ids,result.expected);
 const positions=()=>page.evaluate(()=>[...document.querySelectorAll('.cv-page')].map(p=>[...p.querySelectorAll('.cv-row')].map(r=>({id:r.dataset.rowId,y:Math.round(r.getBoundingClientRect().top-p.getBoundingClientRect().top),h:Math.round(r.getBoundingClientRect().height)}))));
 await page.locator('#resume').evaluate(el=>el.scrollTop=0);
 const baseline=await positions();
 const documentButton=page.getByRole('button',{name:'Example attachment',exact:true});
 await page.mouse.move(0,0);await page.waitForTimeout(280);const compact=await documentButton.boundingBox();
 await page.locator('.cv-row').first().hover();await page.waitForTimeout(280);
 assert((await documentButton.boundingBox()).width>compact.width+40,'hovering the entry expands its document label');
 assert.deepEqual(await positions(),baseline,'document expansion does not shift entries or page breaks');
 await page.mouse.move(0,0);await documentButton.focus();await page.waitForTimeout(280);
 assert((await documentButton.boundingBox()).width>compact.width+40,'keyboard focus expands the label');
 await page.evaluate(()=>document.querySelector('#resume').classList.add('preview-view'));
 assert.deepEqual(await positions(),baseline,'Edit and Preview use identical geometry');
 for(const theme of ['navy','blue-gray','charcoal','forest','burgundy']){await page.evaluate(theme=>document.documentElement.dataset.cvTheme=theme,theme);assert.deepEqual(await positions(),baseline);}
 await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.deepEqual(await positions(),baseline,'A4 print preserves row positions and page breaks');await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
 for(const typography of ['compact','classic']){
  await page.evaluate(value=>{document.documentElement.dataset.cvTypography=value;window.pagination.layout();},typography);
  const typePositions=await positions();await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));
  assert.deepEqual(await positions(),typePositions,'each typography style prints with the same page geometry');await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
 }
 const beforeTimeline=await positions();
 for(const style of ['timeline','plain']){
  await page.evaluate(style=>document.documentElement.dataset.cvEntries=style,style);assert.deepEqual(await positions(),beforeTimeline,'timeline is decorative and preserves geometry');
  if(style==='timeline')assert.equal(await page.locator('[data-section=experience] .cv-row-content').first().evaluate(e=>getComputedStyle(e,'::before').width),'7px');
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert.deepEqual((await inspect()).ids,result.expected);assert.equal((await inspect()).overflows,false);
 console.log('PASS: live A4 pagination preserves entry order and editing across repeated layouts and mobile resize');
}finally{await browser.close();}
