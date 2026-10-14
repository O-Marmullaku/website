// animated by hand: CSS scroll-behavior is dropped when the OS animation setting is off, and the site animates regardless
var portraits = document.getElementById('portraits'), anim = 0;
function slide(by) {
  var from = portraits.scrollLeft, start = performance.now(), dur = 500;
  cancelAnimationFrame(anim);
  portraits.style.scrollSnapType = 'none'; // snapping would yank each intermediate frame back to a portrait edge
  (function frame(now) {
    var t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
    portraits.scrollLeft = from + by * e;
    if (t < 1) anim = requestAnimationFrame(frame);
    else portraits.style.scrollSnapType = '';
  })(start);
}
document.getElementById('goRightCircle').onclick = function() { slide(550); };
document.getElementById('goLeftCircle').onclick = function() { slide(-500); };
