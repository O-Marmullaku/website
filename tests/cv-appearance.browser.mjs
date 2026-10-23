// Optional UI regression: use the same Playwright/Firefox variables as cv-pagination.browser.mjs.
import assert from 'node:assert/strict';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.CHROMIUM_EXECUTABLE||process.env.FIREFOX_EXECUTABLE;
const browser=await playwright[process.env.CHROMIUM_EXECUTABLE?'chromium':'firefox'].launch({headless:true,...(executablePath?{executablePath}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:8000';
try{
 for(const width of [1920,390]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();await page.goto(base);
  await page.setContent(`<html data-live="true"><head><link rel="stylesheet" href="${base}/profile/editor.css"><link rel="stylesheet" href="${base}/main/profile-live.css"><link rel="stylesheet" href="${base}/main/cv-paper.css"></head><body><dialog id="resume" open><div class="resume-toolbar"><div class="cv-view-switch"><div class="cv-mode-options" role="group" aria-label="CV view"><button aria-pressed="true">Edit</button><button aria-pressed="false">Preview</button></div></div></div></dialog></body></html>`);
  await page.evaluate(async base=>{
   const {setupCVAppearance}=await import(base+'/profile/cv-appearance.mjs');
   window.data={theme:'navy',typography:'classic',entryStyle:'plain'};window.changes=[];
   const ui=setupCVAppearance({data:window.data,onChange(field){window.changes.push(field);}});document.querySelector('.cv-view-switch').append(ui.toggle);
  },base);
  const button=page.getByRole('button',{name:'Appearance',exact:true}),panel=page.locator('#cv-appearance');
  const controls=page.locator('.cv-view-switch'),editBounds=await controls.boundingBox();
  await page.locator('#resume').evaluate(e=>e.classList.add('preview-view'));
  assert(await button.isVisible(),'Appearance remains available in Preview');
  assert.deepEqual(await controls.boundingBox(),editBounds,'view controls keep their bounds in Preview');
  await button.click();await panel.waitFor({state:'visible'});
  assert.equal(await panel.getByRole('radio').count(),9);
  const bounds=await panel.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=844);
  await panel.getByRole('radio',{name:'Original blue-gray',exact:true}).check();await panel.getByRole('radio',{name:'Compact',exact:true}).check();await panel.getByRole('radio',{name:'Timeline dots',exact:true}).check();
  assert.deepEqual(await page.evaluate(()=>window.data),{theme:'blue-gray',typography:'compact',entryStyle:'timeline'});assert.deepEqual(await page.evaluate(()=>window.changes),['theme','typography','entryStyle']);
  await panel.getByRole('radio',{name:'Plain',exact:true}).focus();await page.keyboard.press('ArrowRight');assert(await panel.getByRole('radio',{name:'Timeline dots',exact:true}).isChecked());
  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert(await page.locator('#resume').isVisible());await button.click();assert(await panel.getByRole('radio',{name:'Compact',exact:true}).isChecked());await page.getByRole('button',{name:'Close appearance'}).click();
  console.log('PASS',width,'visual choices, keyboard navigation and responsive appearance panel');await context.close();
 }
}finally{await browser.close();}
