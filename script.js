/*
 * Terminal CV.
 * - Each menu entry opens and closes its panel.
 * - A soft light follows the mouse across the page.
 * - The first prompt types itself.
 */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- expandable sections ---------- */
  const items = [...document.querySelectorAll('.item')];

  function setOpen(item, open) {
    const btn = item.querySelector('button');
    const panel = item.querySelector('.panel');
    item.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.state').textContent = open ? '[-]' : '[+]';
    panel.inert = !open;
  }

  items.forEach((item) => {
    setOpen(item, false);
    item.querySelector('button').addEventListener('click', () => {
      const open = !item.classList.contains('open');
      setOpen(item, open);
      history.replaceState(null, '', open ? `#${item.id}` : location.pathname);
    });
  });

  // a link like ...#curriculum opens that section
  const fromHash = () => {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && target.classList.contains('item')) setOpen(target, true);
  };
  fromHash();
  addEventListener('hashchange', fromHash);

  /* ---------- typed prompt ---------- */
  const typed = document.querySelector('.typed');
  if (typed) {
    const text = typed.dataset.text;
    if (reduce) typed.textContent = text;
    else {
      let i = 0;
      const tick = () => { typed.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(tick, 90 + Math.random() * 80); };
      setTimeout(tick, 500);
    }
  }

  /* ---------- light that follows the mouse ---------- */
  const glow = document.querySelector('.glow');
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let tx = innerWidth * 0.3, ty = innerHeight * 0.3, x = tx, y = ty, running = false;
  const k = reduce ? 1 : 0.08; // lower = lazier, softer trail

  function step() {
    x += (tx - x) * k;
    y += (ty - y) * k;
    glow.style.setProperty('--mx', `${x.toFixed(1)}px`);
    glow.style.setProperty('--my', `${y.toFixed(1)}px`);
    if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) requestAnimationFrame(step);
    else running = false;
  }

  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    glow.classList.add('on');
    if (!running) { running = true; requestAnimationFrame(step); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('on'));
})();
