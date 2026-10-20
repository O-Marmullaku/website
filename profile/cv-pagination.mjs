// Move the live elements between sheets so editing and attachments keep their listeners.
export function setupCVPagination(paper) {
  const workspace=paper.parentElement,body=paper.querySelector('.resume-sections');
  const stack=document.createElement('div');stack.className='cv-paper-stack';paper.before(stack);stack.append(paper);
  const columns=[...body.children],portrait=paper.querySelector('.cv-portrait'),header=paper.querySelector('.paper-header');
  const sections=columns.map(column=>[...column.querySelectorAll(':scope > .resume-section')]);
  let pages=[paper],fragments=[],pending=0,busy=false;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
  paper.classList.add('cv-page');
  function restore(){
    for(const {original,fragment} of fragments){
      const target=original.querySelector('.cv-rows');
      if(target)target.append(...fragment.querySelectorAll('.cv-row'));
      const add=fragment.querySelector('.cv-add-row');if(add)original.append(add);
      fragment.remove();
    }
    fragments=[];
    columns[0].prepend(portrait);
    sections.forEach((items,i)=>columns[i].append(...items));
    pages.slice(1).forEach(page=>page.remove());pages=[paper];
    paper.style.height='';
  }
  function sheet(index){
    if(pages[index])return pages[index];
    const page=make('article','paper cv-page cv-page-continuation');
    const header=make('header','cv-running-head',paper.querySelector('#resume-name').textContent);
    const content=make('div','resume-sections');
    content.append(make('div','resume-column'),make('div','resume-column'));
    const footer=make('div','paper-foot','marmullaku.ch ');footer.append(make('span',''));
    page.append(header,content,footer);pages.at(-1).after(page);pages.push(page);return page;
  }
  function flow(items,columnIndex,startIndex=0){
    let index=startIndex;
    const column=()=>sheet(index).querySelector('.resume-sections').children[columnIndex];
    const limit=()=>sheet(index).querySelector('.paper-foot').getBoundingClientRect().top-24;
    const over=element=>element.getBoundingClientRect().bottom>limit()+1;
    for(const original of items){
      if(original.hidden)continue;
      let block=original;
      column().append(block);
      if(!over(block))continue;
      const rows=[...block.querySelectorAll(':scope > .cv-rows > .cv-row')];
      if(!rows.length){
        if(column().children.length>1||column().getBoundingClientRect().top>sheet(index).querySelector('.resume-sections').getBoundingClientRect().top+24){index++;column().append(block);}
        continue;
      }
      const add=block.querySelector('.cv-add-row');add?.remove();
      rows.forEach(row=>row.remove());
      let list=block.querySelector('.cv-rows');
      for(const row of rows){
        list.append(row);
        if(!over(block))continue;
        if(list.children.length===1&&block.getBoundingClientRect().top<=sheet(index).querySelector('.resume-sections').getBoundingClientRect().top+24)continue;
        row.remove();
        if(!list.children.length){index++;column().append(block);list.append(row);continue;}
        index++;
        block=make('section','resume-section cv-section-continuation');
        block.dataset.section=original.dataset.section;block.dataset.field=original.dataset.field;
        const heading=make('div','section-heading');heading.append(original.querySelector('h3').cloneNode(true));
        list=make('div','cv-rows');block.append(heading,list);list.append(row);column().append(block);
        fragments.push({original,fragment:block});
      }
      if(add)block.append(add);
    }
    return index;
  }
  function layout(){
    pending=0;
    const dialog=paper.closest('dialog');
    if(busy||!dialog?.open||stack.getAnimations().some(animation=>animation.playState==='running')||document.querySelector('[contenteditable="plaintext-only"]'))return;
    const scrollTop=dialog.scrollTop;
    busy=true;
    try{
      restore();
      // Phone text reflows at reading size rather than shrinking a desktop sheet to illegible type.
      const phone=innerWidth<=680&&!document.documentElement.classList.contains('cv-printing');
      if(header){if(phone)paper.prepend(header);else columns[1].prepend(header);}
      const tallest=phone?Math.max(0,...Array.from(paper.querySelectorAll('.cv-row'),row=>row.getBoundingClientRect().height)):0;
      workspace.style.setProperty('--cv-page-height',`${Math.max(paper.clientWidth*Math.SQRT2,phone?Math.max(1123,tallest+200):0)}px`);
      [portrait,...sections.flat()].filter(element=>!element.hidden).forEach(element=>element.remove());
      if(phone){
        paper.classList.add('cv-mobile-pages');
        const last=flow([portrait,...sections[0]],0);flow(sections[1],1,last);
      }else{
        paper.classList.remove('cv-mobile-pages');
        flow([portrait,...sections[0]],0);flow(sections[1],1);
      }
      const count=pages.length;
      pages.forEach((page,i)=>{
        page.classList.toggle('cv-mobile-pages',phone);
        page.setAttribute('aria-label',`CV page ${i+1} of ${count}`);
        page.querySelector('.paper-foot span').textContent=`${i+1} / ${count}`;
      });
      dialog.scrollTop=scrollTop;
    }finally{busy=false;}
  }
  function schedule(){cancelAnimationFrame(pending);pending=requestAnimationFrame(layout);}
  addEventListener('resize',schedule);
  addEventListener('beforeprint',()=>{document.documentElement.classList.add('cv-printing');layout();});
  addEventListener('afterprint',()=>{document.documentElement.classList.remove('cv-printing');layout();});
  document.addEventListener('load',event=>{if(event.target.matches?.('.cv-portrait,.cv-row-logo'))schedule();},true);
  return {restore,layout,schedule};
}
