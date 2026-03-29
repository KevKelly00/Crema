export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Fade in images as they load
document.addEventListener('load', e => {
  if (e.target.tagName === 'IMG') e.target.classList.add('loaded');
}, true);

function markLoadedImgs(root) {
  const imgs = root.tagName === 'IMG' ? [root] : root.querySelectorAll('img');
  imgs.forEach(img => { if (img.complete) img.classList.add('loaded'); });
}

// Mark already-complete images when added to DOM (covers cached images)
document.addEventListener('DOMContentLoaded', () => {
  markLoadedImgs(document.body);
  new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) markLoadedImgs(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
});
