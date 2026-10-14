// Sample image previews remain outside the printable résumé.
function mountPlayground(root) {
  root.innerHTML = `<button type="button" class="preview-close">Close preview</button><img class="expanded-sample" width="640" height="400" alt="" /><p class="sample-caption"></p>`;
  root.querySelector('.preview-close').addEventListener('click', () => root.hidePopover());
  const samples = { 'sample-one': 'Lorem ipsum', 'sample-two': 'Dolor sit amet' };
  return id => {
    const label = samples[id];
    if (!label) return;
    const image = root.querySelector('img');
    image.src = 'main/pictures/previews/' + id + '.svg';
    image.alt = label + ' sample preview';
    root.querySelector('p').textContent = label + ' — consectetur adipiscing elit.';
  };
}
