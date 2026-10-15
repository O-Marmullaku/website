export const sectionLabels={contact:'Contact',skills:'Skills',languages:'Languages',profile:'Profile',experience:'Experience',education:'Education',certificates:'Certificates',interests:'Interests'};

// Sections can be visible together. These are overlapping viewing times, not attention estimates.
export function createSectionClock(record,now=()=>performance.now()) {
  let last=now(),visible=new Set();const totals=new Map();
  function flush(field) {
    const milliseconds=totals.get(field)||0;totals.delete(field);
    if(milliseconds>=2000)record(field,Math.round(milliseconds/1000));
  }
  return {
    update(fields){
      const time=now(),elapsed=Math.max(0,time-last);last=time;
      for(const field of visible)totals.set(field,(totals.get(field)||0)+elapsed);
      const next=new Set(fields);for(const field of visible)if(!next.has(field))flush(field);
      visible=next;
    },
    flush(){for(const field of totals.keys())flush(field);}
  };
}

export function mountSectionTiming(adapter) {
  if(!adapter.guest)return;
  const resume=document.getElementById('resume'),toolbar=resume.querySelector('.resume-toolbar');
  const notice=document.createElement('aside');notice.className='reading-feedback';
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';
  label.append(check,document.createTextNode('Share section viewing time'));
  const help=document.createElement('p');help.id='reading-feedback-help';
  help.textContent='Optional. Shares time sections are in view, not cursor movements. Link and PDF opens are recorded separately.';
  check.setAttribute('aria-describedby',help.id);notice.append(label,help);toolbar.after(notice);
  let lastInput=performance.now();
  const clock=createSectionClock((section,seconds)=>adapter.request('event',{kind:'section',section,seconds,consent:true}).catch(()=>{}));
  function pulse() {
    const enabled=check.checked&&resume.open&&document.visibilityState==='visible'&&document.hasFocus()&&performance.now()-lastInput<60000;
    const top=toolbar.getBoundingClientRect().bottom;
    const fields=enabled?[...resume.querySelectorAll('.paper [data-section]')].filter(el=>{
      const rect=el.getBoundingClientRect(),height=Math.min(rect.bottom,innerHeight)-Math.max(rect.top,top);
      return rect.width>0&&height>=Math.min(rect.height*.5,200)&&rect.right>0&&rect.left<innerWidth;
    }).map(el=>el.dataset.section).filter(field=>sectionLabels[field]):[];
    clock.update(fields);
  }
  function input(){lastInput=performance.now();pulse();}
  for(const event of ['pointerdown','keydown','scroll'])document.addEventListener(event,input,{capture:true,passive:true});
  check.addEventListener('change',input);
  document.addEventListener('visibilitychange',pulse);addEventListener('focus',pulse);addEventListener('blur',pulse);
  const interval=setInterval(pulse,1000),checkpoint=setInterval(()=>{pulse();clock.flush();},30000);
  function stop(){clearInterval(interval);clearInterval(checkpoint);clock.update([]);clock.flush();}
  resume.addEventListener('close',stop,{once:true});addEventListener('pagehide',stop,{once:true});
}
