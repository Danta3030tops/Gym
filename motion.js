/* =====================================================================
   MOTION: sliding nav pill, swipe-down-to-close sheets, first-load stagger
   ===================================================================== */
(function () {
  const nav = document.querySelector('nav');
  const pill = document.createElement('i'); pill.className = 'navpill'; nav.prepend(pill); nav.classList.add('pilled');
  window.movePill = function () {
    const b = nav.querySelector('button.on'); if (!b) { pill.style.opacity = 0; return; }
    const nr = nav.getBoundingClientRect(), br = b.getBoundingClientRect();
    pill.style.opacity = 1; pill.style.width = br.width + 'px'; pill.style.transform = `translateX(${br.left - nr.left}px)`;
  };
  addEventListener('resize', movePill);
  new MutationObserver(movePill).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  setTimeout(movePill, 50);

  /* drag a sheet down to dismiss it */
  const sh = document.getElementById('sheet'); let y0 = null, dy = 0, t0 = 0;
  sh.addEventListener('touchstart', e => {
    if (!sh.classList.contains('show') || sh.scrollTop > 0) return;
    const tag = e.target.tagName; if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.closest('input[type=range]')) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
  }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return; dy = e.touches[0].clientY - y0;
    if (dy <= 0 || sh.scrollTop > 0) { if (dy < 0) { y0 = null; sh.classList.remove('drag'); sh.style.transform = ''; } return; }
    sh.classList.add('drag'); sh.style.transform = `translateY(${dy < 0 ? 0 : dy}px)`;
  }, { passive: true });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return; const fast = dy > 60 && Date.now() - t0 < 250; y0 = null;
    sh.classList.remove('drag'); sh.style.transform = '';
    if (dy > 110 || fast) closeSheet();
  });

  window.__stagger = true;
  if (typeof tab !== 'undefined' && tab === 'workout' && typeof renderWorkout === 'function' && document.getElementById('list').children.length) renderWorkout();
})();
