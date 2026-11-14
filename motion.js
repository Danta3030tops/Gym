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
  const sh = document.getElementById('sheet'), ov = document.getElementById('ov'); let y0 = null, dy = 0, t0 = 0, hgt = 1;
  const endDrag = () => { y0 = null; sh.classList.remove('drag'); ov.classList.remove('drag'); sh.style.transform = ''; ov.style.opacity = ''; };
  sh.addEventListener('touchstart', e => {
    if (!sh.classList.contains('show') || sh.scrollTop > 0 || e.touches.length > 1) return;
    const tag = e.target.tagName; if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.closest('input[type=range]')) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); hgt = sh.offsetHeight || 1;
  }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return; dy = e.touches[0].clientY - y0;
    if (dy <= 0 || sh.scrollTop > 0) { if (dy < 0) endDrag(); return; }
    sh.classList.add('drag'); ov.classList.add('drag'); sh.style.transform = `translateY(${dy}px)`;
    ov.style.opacity = Math.max(.3, 1 - dy / hgt); // the dim lifts as the sheet comes down
  }, { passive: true });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return; const close = dy > 110 || (dy > 60 && Date.now() - t0 < 250);
    endDrag(); if (close) closeSheet();
  });
  sh.addEventListener('touchcancel', endDrag); // a call or system gesture mid-drag used to leave the sheet stuck half down
  addEventListener('keydown', e => { if (e.key === 'Escape' && sh.classList.contains('show')) closeSheet(); });

  window.__stagger = true;
  if (typeof tab !== 'undefined' && tab === 'workout' && typeof renderWorkout === 'function' && document.getElementById('list').children.length) renderWorkout();
})();
