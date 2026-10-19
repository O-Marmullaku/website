const ease='cubic-bezier(.2,.8,.2,1)';
export function cardProjection(card,paper) {
  const scale=card.width/paper.width;
  return {transform:`translate(${card.left+card.width/2-paper.left-paper.width/2}px, ${card.top-paper.top}px) scale(${scale})`,clipPath:`inset(0px 0px ${Math.max(0,paper.height-card.height/scale)}px 0px round ${6/scale}px)`};
}
export function createProfileMotion(panel) {
  let animations=[],cardFade,card,view,generation=0;
  const play=(element,frames,options)=>{const animation=element.animate(frames,options);animations.push(animation);return animation.finished.catch(()=>{});};
  const stop=()=>{animations.forEach(animation=>animation.cancel());animations=[];};
  const visual=frame=>frame?.contentDocument?.querySelector(view==='settings'?'#settings-panel':'.cv-paper-stack, .paper');
  return {
    async enter(frame,origin,mode) {
      const current=++generation;stop();cardFade?.cancel();card=origin?.closest('.card');view=mode;
      panel.classList.remove('is-closing');panel.dataset.motion='entering';
      const element=visual(frame);frame.classList.remove('profile-frame-loading');
      const tasks=[play(frame,[{opacity:0},{opacity:1}],{duration:240,easing:ease})];
      const rail=view==='cv'&&frame.contentDocument?.querySelector('#extras-rail');
      if(rail&&!rail.hidden)tasks.push(play(rail,[{opacity:0,transform:'translateX(16px)'},{opacity:1,transform:'none'}],{duration:380,delay:220,easing:ease,fill:'backwards'}));
      if(element&&card&&view==='cv') {
        const rect=element.getBoundingClientRect(),from=cardProjection(card.getBoundingClientRect(),rect);
        element.style.transformOrigin='50% 0';
        cardFade=card.animate([{opacity:1},{opacity:0}],{duration:260,fill:'forwards'});cardFade.finished.catch(()=>{});
        tasks.push(play(element,[{...from,opacity:.15},{...from,opacity:1,offset:.18},{transform:'none',clipPath:`inset(0px 0px ${Math.max(0,rect.height-frame.clientHeight+64)}px 0px round 2px)`,offset:.72},{transform:'none',clipPath:'inset(-80px -80px -80px -80px round 2px)',opacity:1}],{duration:650,easing:'cubic-bezier(.3,.7,.2,1)'}));
      } else if(element) tasks.push(play(element,[{opacity:0,transform:view==='settings'?'translateX(40px)':'translateY(14px) scale(.985)'},{opacity:1,transform:'none'}],{duration:280,easing:ease}));
      await Promise.all(tasks);if(current===generation&&panel.dataset.motion==='entering')panel.dataset.motion='open';
    },
    async exit(frame) {
      generation++;
      const element=visual(frame),style=element&&frame.contentWindow.getComputedStyle(element),current=style&&{opacity:style.opacity,transform:style.transform,clipPath:style.clipPath};
      const opacity=frame?frame.contentWindow.getComputedStyle(frame).opacity:1;
      const rail=view==='cv'&&frame?.contentDocument?.querySelector('#extras-rail');
      const railStyle=rail&&frame.contentWindow.getComputedStyle(rail);
      const railFrom=railStyle&&{opacity:railStyle.opacity,transform:railStyle.transform};
      stop();panel.classList.add('is-closing');panel.dataset.motion='closing';
      const duration=view==='cv'&&card?420:200,tasks=[];
      if(rail&&!rail.hidden)tasks.push(play(rail,[railFrom,{opacity:0,transform:'translateX(10px)'}],{duration:160,easing:ease,fill:'forwards'}));
      if(element) {
        const to=view==='cv'&&card?.isConnected?cardProjection(card.getBoundingClientRect(),element.getBoundingClientRect()):{transform:view==='settings'?'translateX(26px)':'translateY(8px) scale(.985)'};
        tasks.push(play(element,[current,{...to,opacity:0}],{duration,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}));
      }
      if(frame)tasks.push(play(frame,[{opacity},{opacity,offset:.45},{opacity:0}],{duration,fill:'forwards'}));
      if(card)tasks.push(play(card,[{opacity:0},{opacity:1}],{duration:Math.min(duration,300),delay:duration*.25,fill:'forwards'}));
      await Promise.all(tasks);
    },
    reset(){generation++;stop();cardFade?.cancel();cardFade=null;card=null;panel.classList.remove('is-closing');delete panel.dataset.motion;}
  };
}
