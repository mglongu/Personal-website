/*
 * - Sections open and close (click the title or the +/−).
 * - The company strip loops seamlessly (the list is duplicated once).
 * - A soft light follows the mouse.
 * Without JavaScript every section stays open and the strip stays still.
 */
(() => {
  document.documentElement.classList.add('js');

  /* ---------- open / close sections ---------- */
  document.querySelectorAll('.item').forEach((item) => {
    const btn = item.querySelector('button');
    const pm = item.querySelector('.pm');
    const panel = item.querySelector('.panel');
    const set = (open) => {
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      pm.textContent = open ? '−' : '+';
      panel.inert = !open;
    };
    set(location.hash === `#${item.id}`);
    btn.addEventListener('click', () => set(!item.classList.contains('open')));
  });

  /* ---------- company strip: duplicate for a seamless loop ---------- */
  const track = document.querySelector('.strip-track');
  if (track) {
    [...track.children].forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
      track.appendChild(copy);
    });
  }

  /* ---------- light that follows the mouse ---------- */
  const glow = document.querySelector('.glow');
  if (!glow || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tx = innerWidth * 0.25, ty = innerHeight * 0.3, x = tx, y = ty, running = false;

  const step = () => {
    x += (tx - x) * (reduce ? 1 : 0.08);
    y += (ty - y) * (reduce ? 1 : 0.08);
    glow.style.setProperty('--mx', `${x.toFixed(1)}px`);
    glow.style.setProperty('--my', `${y.toFixed(1)}px`);
    if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) requestAnimationFrame(step);
    else running = false;
  };

  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    glow.classList.add('on');
    if (!running) { running = true; requestAnimationFrame(step); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('on'));
})();
