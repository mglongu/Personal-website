/*
 * One red thread.
 * A ball of yarn sits in the hero. As you scroll it rolls down the page,
 * shrinking as it unravels, and leaves the thread behind it. Each role is a
 * knot; the knots get looser as the career goes on.
 * Background: a field of fibres that swirl around the cursor. Click to send a ripple.
 */
(() => {
  const root = document.documentElement;
  root.classList.add('js');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height / 2, top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX, w: r.width, h: r.height }; };

  /* ================= marquee: duplicate the list for a seamless loop ================= */
  $$('.marquee-track').forEach((track) => {
    [...track.children].forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
      track.appendChild(c);
    });
  });

  /* ================= reveal on scroll (with a failsafe) ================= */
  const revealEls = $$('.sec-head, .xp-item, .tools li, .numbers div, .contact .wrap > *:not(.node), .companies .kicker');
  revealEls.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = `${(i % 4) * 70}ms`; });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else revealEls.forEach((el) => el.classList.add('in'));

  /* ================= the yarn ================= */
  const svg = $('#yarn');
  const thread = $('#thread');
  const ballG = $('#ball');
  const endDot = $('#yarn-end');
  const anchor = $('#ball-anchor');
  const hero = $('.hero');
  const xpSection = $('#experience');
  const items = $$('.xp-item');
  const endAnchor = $('#thread-end');
  const NS = 'http://www.w3.org/2000/svg';

  // ball drawn in a 100-unit radius, scaled at runtime
  const strands = [];
  (() => {
    const disc = document.createElementNS(NS, 'circle');
    disc.setAttribute('r', 100);
    ballG.appendChild(disc);
    const rand = rng(7);
    const N = 15;
    for (let i = 0; i < N; i++) {
      const rx = 92 - rand() * 14;
      const ry = rx * (0.12 + rand() * 0.88);
      const rot = rand() * 180;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${-rx},0 A${rx},${ry} 0 1,0 ${rx},0 A${rx},${ry} 0 1,0 ${-rx},0`);
      p.setAttribute('transform', `rotate(${rot.toFixed(1)})`);
      ballG.appendChild(p);
      strands.push(p);
    }
  })();

  function toPath(p) {
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ` +
           `${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ` +
           `${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  // a knot: enters at the top of a circle, loops, leaves at the bottom
  function knot(pts, cx, cy, r, loops, mess, seed) {
    const rand = rng(seed);
    const total = Math.PI * 2 * loops + Math.PI;
    const steps = Math.max(12, Math.round(loops * 22 + 14));
    const ph = [rand() * 6, rand() * 6, rand() * 6];
    const dir = rand() > .5 ? 1 : -1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const env = Math.pow(Math.sin(Math.PI * t), .6);
      const a = -Math.PI / 2 + dir * total * t;
      const wob = 1 + env * mess * (0.15 * Math.sin(t * 23 + ph[0]) + 0.1 * Math.sin(t * 47 + ph[1]));
      const dx = env * mess * r * 0.3 * Math.sin(t * 6.3 + ph[2]);
      const dy = env * mess * r * 0.25 * Math.cos(t * 5.1 + ph[1]);
      pts.push([cx + dx + Math.cos(a) * r * wob, cy + dy + Math.sin(a) * r * wob]);
    }
  }

  // a soft wandering line between two points
  function wander(pts, a, b, amp, seed, W) {
    const rand = rng(seed);
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(3, Math.round(dist / 40));
    const f = 0.5 + rand() * 0.9, ph = rand() * Math.PI * 2;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const e = t * t * (3 - 2 * t);
      const x = a[0] + (b[0] - a[0]) * e + amp * Math.sin(Math.PI * t) * Math.sin(t * Math.PI * 2 * f + ph);
      const y = a[1] + (b[1] - a[1]) * t;
      pts.push([clamp(x, 10, W - 10), y]);
    }
    pts.push(b);
  }

  let L = 1, samples = [], built = false, mobile = false;
  let R = 150, startY = 0, endY = 1, pLane = 0.2, sLane = 0.3, sMin = 0.1;
  let curP = 0, lastLen = 0, spin = 0, introK = reduce ? 1 : 0, introT0 = 0;

  function build() {
    svg.setAttribute('height', 0);
    const W = root.clientWidth;
    const H = root.scrollHeight;
    mobile = innerWidth <= 760;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const a = box(anchor);
    R = Math.min(a.w, a.h) * 0.4;
    const start = [a.x, a.y];
    const pts = [start];

    const n0 = box(items[0].querySelector('.node'));
    const laneX = n0.x;
    const h = box(hero), xs = box(xpSection);

    // one long smooth S-curve: down from the ball, then across into the lane
    const end0 = [laneX, xs.top + (mobile ? 30 : 60)];
    const c1 = [mobile ? W - 24 : a.x + 40, h.bottom - (mobile ? 60 : 120)];
    const c2 = [laneX + (mobile ? 10 : 60), h.bottom - (mobile ? 20 : 40)];
    const segs = 60;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs, u = 1 - t;
      pts.push([
        u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end0[0],
        u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end0[1],
      ]);
    }
    let prev = end0;

    items.forEach((li, i) => {
      const n = box(li.querySelector('.node'));
      const loops = parseFloat(li.dataset.loops);
      const mess = parseFloat(li.dataset.mess);
      const seed = parseInt(li.dataset.seed, 10);
      const r = mobile ? 11 - i : 30 - i * 3;
      if (loops > 0) {
        wander(pts, prev, [n.x, n.y - r], mobile ? 3 : 14, seed + 1, W);
        knot(pts, n.x, n.y, r, loops, mess, seed);
        prev = [n.x, n.y + r];
        pts.push(prev);
      } else {
        wander(pts, prev, [n.x, n.y], mobile ? 3 : 10, seed + 1, W);
        prev = [n.x, n.y];
      }
    });

    // calm and straight from here on: the thread is untangled
    const e = box(endAnchor);
    wander(pts, prev, [e.x, e.y], mobile ? 6 : 22, 99, W);

    thread.setAttribute('d', toPath(pts));
    L = thread.getTotalLength();
    thread.style.strokeDasharray = `${L} ${L}`;
    endDot.setAttribute('cx', e.x); endDot.setAttribute('cy', e.y);

    // lookup: how much thread reaches a given page height
    samples = [];
    let maxY = -Infinity;
    for (let l = 0; l <= L; l += 8) {
      maxY = Math.max(maxY, thread.getPointAtLength(l).y);
      samples.push([l, maxY]);
    }
    samples.push([L, Math.max(maxY, e.y)]);

    startY = start[1];
    endY = e.y;
    pLane = clamp(lengthAtY(n0.y) / L, 0.05, 0.9);
    const laneW = mobile ? 40 : 130;
    sLane = clamp((laneW * (mobile ? 0.42 : 0.3)) / R, 0.08, 1);
    sMin = sLane * 0.3;
    lastLen = curP * L;
    built = true;
  }

  function lengthAtY(y) {
    let lo = 0, hi = samples.length - 1;
    if (y <= samples[0][1]) return 0;
    if (y >= samples[hi][1]) return L;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (samples[mid][1] < y) lo = mid + 1; else hi = mid; }
    return samples[lo][0];
  }

  function targetP() {
    const max = root.scrollHeight - innerHeight;
    const k = max > 0 ? clamp(scrollY / max, 0, 1) : 1;
    return lengthAtY(lerp(startY, endY, k)) / L;
  }

  const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

  function drawYarn(now) {
    const t = targetP();
    curP = reduce ? t : curP + (t - curP) * 0.11;
    if (Math.abs(t - curP) < 0.00005) curP = t;
    const len = curP * L;
    thread.style.strokeDashoffset = L - len;

    // size: shrinks fast until it fits the lane, then slowly to almost nothing
    let s = curP <= pLane
      ? lerp(1, sLane, Math.pow(curP / pLane, 0.8))
      : lerp(sLane, sMin, (curP - pLane) / (1 - pLane));
    if (!reduce) {
      if (!introT0) introT0 = now;
      introK = clamp((now - introT0 - 250) / 1100, 0, 1);
      s *= introK < 1 ? Math.max(0, easeOutBack(introK)) : 1;
    }
    const radius = Math.max(0.5, R * s);

    // rolling: the ball turns by the distance travelled over its radius
    spin += (len - lastLen) / radius + (reduce ? 0 : 0.0025);
    lastLen = len;

    const p = thread.getPointAtLength(len);
    ballG.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${(spin * 57.2958).toFixed(1)}) scale(${(radius / 100).toFixed(4)})`);

    // strands fall away as it unravels
    const keep = lerp(strands.length, 3, clamp(curP * 1.15, 0, 1));
    strands.forEach((st, i) => { st.style.opacity = clamp(keep - i, 0, 1).toFixed(2); });
    endDot.style.opacity = curP > 0.985 ? 1 : 0;
  }

  /* ================= background field + cursor thread ================= */
  const cv = $('#field');
  const ctx = cv.getContext('2d');
  let dpr = 1, VW = 0, VH = 0;
  const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999, in: false, down: false };
  const waves = [];
  const rope = [];
  const ROPE_N = 14, ROPE_SEG = 6;

  function sizeCanvas() {
    dpr = Math.min(2, devicePixelRatio || 1);
    VW = innerWidth; VH = innerHeight;
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawField(now) {
    ctx.clearRect(0, 0, VW, VH);
    const S = mobile ? 30 : 26;
    const off = (scrollY * 0.35) % S;
    const t = reduce ? 0 : now;
    const RAD = 180;
    mouse.sx = lerp(mouse.sx, mouse.x, 0.18);
    mouse.sy = lerp(mouse.sy, mouse.y, 0.18);
    const mx = mouse.sx, my = mouse.sy;

    // ripples
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.r = (now - w.t0) * 0.7;
      if (w.r > Math.max(VW, VH) * 1.2) waves.splice(i, 1);
    }

    const hot = [];
    ctx.beginPath();
    for (let y = -off - S; y < VH + S; y += S) {
      const gy = y + scrollY * 0.35; // stable id for the noise
      for (let x = S / 2; x < VW; x += S) {
        let ang = Math.sin(x * 0.0045 + t * 0.00018) * 1.3 + Math.cos(gy * 0.005 - t * 0.00014) * 1.1 + Math.sin((x + gy) * 0.0021) * 0.8;
        let len = 7, px = x, py = y, k = 0;
        if (mouse.in) {
          const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy);
          if (d < RAD) {
            k = Math.pow(1 - d / RAD, 2);
            const sw = Math.atan2(dy, dx) + Math.PI / 2;
            ang = lerp(ang, sw, k);
            len += k * 12;
            px += (dx / (d || 1)) * k * 14;
            py += (dy / (d || 1)) * k * 14;
          }
        }
        for (const w of waves) {
          const dx = x - w.x, dy = y - w.y, d = Math.hypot(dx, dy);
          const band = 1 - Math.abs(d - w.r) / 60;
          if (band > 0) {
            const fade = Math.max(0, 1 - w.r / (Math.max(VW, VH) * 1.1));
            const kk = band * fade;
            px += (dx / (d || 1)) * kk * 16;
            py += (dy / (d || 1)) * kk * 16;
            ang = lerp(ang, Math.atan2(dy, dx), kk);
            len += kk * 8;
            k = Math.max(k, kk);
          }
        }
        const cx = Math.cos(ang) * len / 2, cy = Math.sin(ang) * len / 2;
        if (k > 0.04) hot.push(px - cx, py - cy, px + cx, py + cy, k);
        else { ctx.moveTo(px - cx, py - cy); ctx.lineTo(px + cx, py + cy); }
      }
    }
    ctx.strokeStyle = 'rgba(242,237,227,0.09)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    for (let i = 0; i < hot.length; i += 5) {
      const k = hot[i + 4];
      ctx.strokeStyle = `rgba(255,90,71,${(0.12 + k * 0.75).toFixed(3)})`;
      ctx.lineWidth = 1.2 + k * 0.8;
      ctx.beginPath(); ctx.moveTo(hot[i], hot[i + 1]); ctx.lineTo(hot[i + 2], hot[i + 3]); ctx.stroke();
    }

    if (finePointer && !reduce) drawRope();
  }

  // a short loose thread hanging from the cursor, like a needle being pulled
  function drawRope() {
    if (mouse.x < -1000) return;
    if (!rope.length) for (let i = 0; i < ROPE_N; i++) rope.push({ x: mouse.x, y: mouse.y + i * ROPE_SEG, px: mouse.x, py: mouse.y + i * ROPE_SEG });
    rope[0].x = rope[0].px = mouse.x; rope[0].y = rope[0].py = mouse.y;
    for (let i = 1; i < ROPE_N; i++) {
      const p = rope[i];
      const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + 0.32;
    }
    for (let it = 0; it < 5; it++) {
      for (let i = 1; i < ROPE_N; i++) {
        const a = rope[i - 1], b = rope[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const diff = (d - ROPE_SEG) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
    }
    ctx.globalAlpha = mouse.in ? 1 : 0;
    ctx.strokeStyle = '#FF5A47';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(rope[0].x, rope[0].y);
    for (let i = 1; i < ROPE_N - 1; i++) {
      const mxp = (rope[i].x + rope[i + 1].x) / 2, myp = (rope[i].y + rope[i + 1].y) / 2;
      ctx.quadraticCurveTo(rope[i].x, rope[i].y, mxp, myp);
    }
    ctx.stroke();
    ctx.fillStyle = '#FF5A47';
    ctx.beginPath(); ctx.arc(rope[0].x, rope[0].y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ================= custom cursor ================= */
  const cursor = $('.cursor');
  const label = $('.cursor-label');
  const ring = { x: -100, y: -100 };
  if (finePointer) root.classList.add('has-cursor');

  function cursorTarget(el) {
    const tagged = el && el.closest('[data-cursor]');
    let text = tagged ? tagged.dataset.cursor : '';
    if (text === 'open') text = tagged.closest('details').open ? 'close' : 'open';
    const link = el && el.closest('a, button, summary');
    cursor.classList.toggle('has-label', !!text);
    cursor.classList.toggle('is-link', !!link && !text);
    label.textContent = text;
  }

  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
    if (mouse.sx < -1000) { mouse.sx = mouse.x; mouse.sy = mouse.y; ring.x = mouse.x; ring.y = mouse.y; }
    if (e.pointerType === 'mouse') cursorTarget(e.target);
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    mouse.down = true; cursor.classList.add('is-down');
    if (!reduce && !e.target.closest('a, button, summary')) waves.push({ x: e.clientX, y: e.clientY, t0: performance.now(), r: 0 });
  });
  addEventListener('pointerup', (e) => {
    mouse.down = false; cursor.classList.remove('is-down');
    if (e.pointerType !== 'mouse') mouse.in = false;
  });
  document.addEventListener('pointerleave', () => { mouse.in = false; cursor.classList.add('is-hidden'); });
  document.addEventListener('pointerenter', () => { cursor.classList.remove('is-hidden'); });
  document.addEventListener('toggle', () => cursorTarget(document.elementFromPoint(mouse.x, mouse.y)), true);

  function drawCursor() {
    if (!finePointer) return;
    ring.x = lerp(ring.x, mouse.x, reduce ? 1 : 0.22);
    ring.y = lerp(ring.y, mouse.y, reduce ? 1 : 0.22);
    cursor.style.transform = `translate3d(${ring.x.toFixed(1)}px, ${ring.y.toFixed(1)}px, 0)`;
  }

  /* ================= magnetic button ================= */
  if (finePointer && !reduce) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .15s ease-out, background-color .3s, color .3s';
        el.style.transform = `translate(${dx * 0.28}px, ${dy * 0.38}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1.4), background-color .3s, color .3s';
        el.style.transform = '';
      });
    });
  }

  /* ================= loop ================= */
  let wasScrolled = null;
  function frame(now) {
    const sc = scrollY > 20;
    if (sc !== wasScrolled) { document.body.classList.toggle('scrolled', sc); wasScrolled = sc; }
    if (built) drawYarn(now);
    drawField(now);
    drawCursor();
    requestAnimationFrame(frame);
  }

  /* ================= boot ================= */
  let rt = 0, lastW = 0, booted = false;
  const rebuild = () => { clearTimeout(rt); rt = setTimeout(build, 80); };

  function boot() {
    if (booted) { rebuild(); return; }
    booted = true;
    lastW = innerWidth;
    sizeCanvas();
    build();
    requestAnimationFrame(frame);
    addEventListener('resize', () => {
      sizeCanvas();
      if (innerWidth !== lastW) { lastW = innerWidth; rebuild(); }
    });
    // page height changes when a role is opened, fonts load, etc.
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe($('main'));
  }

  // start right away; rebuild once fonts and everything else have loaded
  boot();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  addEventListener('load', rebuild);
})();
