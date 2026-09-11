// Match the travel bounds to visible letter bounds, excluding line-height leading.
const hint = document.querySelector('.mobile-hint');
const copy = hint.querySelector('.swipe-copy');
const ctx = document.createElement('canvas').getContext('2d');
function inkBounds(element) {
  const style = getComputedStyle(element);
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = ctx.measureText(element.textContent);
  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect();
  const baseline = rect.top + metrics.fontBoundingBoxAscent;
  return { top: baseline - metrics.actualBoundingBoxAscent,
    bottom: baseline + metrics.actualBoundingBoxDescent };
}
function alignCue() {
  if (!hint.getClientRects().length) return;
  const top = inkBounds(copy.firstElementChild).top;
  const bottom = inkBounds(copy.lastElementChild).bottom;
  hint.style.setProperty('--cue-top', `${top - hint.getBoundingClientRect().top}px`);
  hint.style.setProperty('--cue-height', `${bottom - top}px`);
}
new ResizeObserver(alignCue).observe(copy);
document.fonts.ready.then(alignCue);
window.addEventListener('resize', alignCue);
