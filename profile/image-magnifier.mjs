export function magnifierGeometry(box, natural, fit = 'fill', position = '50% 50%') {
  let width = box.width, height = box.height;
  if (['cover', 'contain', 'none', 'scale-down'].includes(fit)) {
    const scale = fit === 'none' ? 1 : fit === 'cover'
      ? Math.max(width / natural.width, height / natural.height)
      : Math.min(width / natural.width, height / natural.height, fit === 'scale-down' ? 1 : Infinity);
    width = natural.width * scale; height = natural.height * scale;
  }
  const offsets = position.split(/\s+/);
  const offset = (value, space) => value?.endsWith('%') ? parseFloat(value) * space / 100 : parseFloat(value) || 0;
  return {width, height, left: box.left + offset(offsets[0], box.width - width), top: box.top + offset(offsets[1] || offsets[0], box.height - height)};
}

export function setupImageMagnifier(root = document) {
  const doc = root.ownerDocument || root, win = doc.defaultView;
  const selector = '.extra-picture img, img.cv-portrait, img.cv-row-logo, #document-reader canvas';
  const style = doc.createElement('style');
  style.textContent = `.image-magnifier{position:fixed;inset:auto;margin:0;padding:0;z-index:100;pointer-events:none;width:220px;height:220px;max-width:70vw;max-height:70vw;border:2px solid #f6f9ff;border-radius:8px;background-color:white;background-repeat:no-repeat;box-shadow:0 12px 40px #0008;opacity:0;transition:opacity .16s,scale .16s;scale:.96}.image-magnifier.is-visible{opacity:1;scale:1}.image-magnifiable{cursor:zoom-in}.image-magnifiable[aria-pressed=true]{cursor:zoom-out}`;
  doc.head.append(style);
  const lens = doc.createElement('div');lens.className = 'image-magnifier';lens.setAttribute('aria-hidden', 'true');
  lens.setAttribute('popover', 'manual');doc.body.append(lens);
  let source = null, imageURL = '', closing;
  function dismiss() {
    source?.setAttribute('aria-pressed', 'false');source = null;
    lens.classList.remove('is-visible');
    clearTimeout(closing);closing = setTimeout(() => {if (!source) lens.hidePopover();}, 170);
  }
  function move(x, y) {
    if (!source?.isConnected) return dismiss();
    const box = source.getBoundingClientRect();
    if (!box.width || !box.height) return dismiss();
    const computed = win.getComputedStyle(source);
    const graphic = magnifierGeometry(box, {width:source.naturalWidth || source.width,height:source.naturalHeight || source.height}, source.tagName === 'IMG' ? computed.objectFit : 'fill', computed.objectPosition);
    const size = Math.min(220, win.innerWidth * .7), half = size / 2;
    lens.style.width = lens.style.height = `${size}px`;
    lens.style.left = `${Math.max(8,Math.min(win.innerWidth-size-8,x-half))}px`;
    lens.style.top = `${Math.max(8,Math.min(win.innerHeight-size-8,y-half))}px`;
    lens.style.backgroundSize = `${graphic.width*2}px ${graphic.height*2}px`;
    lens.style.backgroundPosition = `${half-(x-graphic.left)*2}px ${half-(y-graphic.top)*2}px`;
  }
  function activate(target, x, y) {
    if (target === source) return dismiss();
    dismiss();clearTimeout(closing);
    try {imageURL = target.tagName === 'CANVAS' ? target.toDataURL('image/png') : target.currentSrc || target.src;} catch {return;}
    if (!imageURL) return;
    source = target;source.setAttribute('aria-pressed', 'true');
    lens.style.backgroundImage = `url(${JSON.stringify(imageURL)})`;
    if (!lens.matches(':popover-open')) lens.showPopover();
    move(x,y);win.requestAnimationFrame(() => {if(source === target) lens.classList.add('is-visible');});
  }
  function decorate() {
    root.querySelectorAll(selector).forEach(element => {
      if (element.closest('a,button')) return;
      element.classList.add('image-magnifiable');element.tabIndex = 0;element.setAttribute('role','button');
      if (!element.hasAttribute('aria-pressed')) element.setAttribute('aria-pressed','false');
      if (!element.hasAttribute('data-magnifier-label')) {
        element.setAttribute('aria-label',`Magnify ${element.getAttribute('alt') || element.getAttribute('aria-label') || 'image'}`);
        element.dataset.magnifierLabel = 'true';
      }
    });
  }
  root.addEventListener('click', event => {
    const target = event.target.closest(selector);
    if (target?.classList.contains('image-magnifiable')) {const box=target.getBoundingClientRect();activate(target,event.detail?event.clientX:box.left+box.width/2,event.detail?event.clientY:box.top+box.height/2);}
    else if (source) dismiss();
  });
  root.addEventListener('pointermove', event => {if (source && event.target === source) move(event.clientX,event.clientY);});
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && source) {event.preventDefault();event.stopImmediatePropagation();dismiss();}
    else if (['Enter',' '].includes(event.key) && event.target.matches(selector)) {event.preventDefault();event.target.click();}
  }, true);
  win.addEventListener('scroll', dismiss, true);win.addEventListener('resize',dismiss);
  new MutationObserver(decorate).observe(root === doc ? doc.body : root,{childList:true,subtree:true});
  decorate();return {dismiss};
}
