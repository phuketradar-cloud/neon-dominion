// Viewport acceptance check (V3): call window.ndViewportCheck() on any screen.
// Fails if the page scrolls, if any visible container needs scrolling to reach its content, if any
// visible control lies outside the window, or if visible text is smaller than 12px.
window.ndViewportCheck = function () {
  const W = window.innerWidth, H = window.innerHeight, out = { w: W, h: H, problems: [] };
  const de = document.documentElement;
  if (de.scrollHeight > H + 1) out.problems.push(`page scrolls vertically (${de.scrollHeight} > ${H})`);
  if (de.scrollWidth > W + 1) out.problems.push(`page scrolls horizontally (${de.scrollWidth} > ${W})`);
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const name = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('#tip,#tooltip,#toasts,#turnflash,#busy,#tut-card,#tut-ring')) continue;
    const cs = getComputedStyle(el);
    // a container whose content is cut off and only reachable by scrolling
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) out.problems.push(`scroll container ${name(el)} (${el.scrollHeight} > ${el.clientHeight})`);
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) out.problems.push(`h-scroll container ${name(el)}`);
    if (el.matches('button, select, input, [data-cmd], [data-act], [data-screen]')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.bottom > H + 1 || r.right > W + 1 || r.top < -1 || r.left < -1)) out.problems.push(`control outside viewport ${name(el)} ${Math.round(r.left)},${Math.round(r.top)}`);
    }
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const fs = parseFloat(cs.fontSize);
      if (fs < 11.5) out.problems.push(`small text ${fs}px in ${name(el)}`);
    }
  }
  out.problems = [...new Set(out.problems)].slice(0, 25);
  out.ok = out.problems.length === 0;
  return out;
};
