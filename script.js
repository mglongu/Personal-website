/*
 * One red thread.
 * A tangled ball in the hero pulls out into a single thread that runs down the
 * whole page. Each career step is a knot; knots get looser as the career goes on.
 * The thread is drawn as you scroll.
 */
(() => {
  document.documentElement.classList.add('js');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const svg = $('#yarn');
  const ballPath = $('#ball-path');
  const threadPath = $('#thread-path');
  const arrow = $('#thread-arrow');
  const tip = $('#thread-tip');
  const startDot = $('#yarn-start');
  const ballAnchor = $('#ball-anchor');
  const sweep = $('.sweep');
  const method = $('.method');
  const endAnchor = $('#thread-end');
  const items = $$('.tl-item');
  const tickYear = $('#tick-year');
  const tickBar = $('#tick-bar');
  const ticker = $('.ticker');
  const timeline = $('.timeline');

  /* ---------- helpers ---------- */
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height / 2, top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX, w: r.width, h: r.height }; };

  // Smooth a list of points with Catmull-Rom → cubic Bézier.
  function toPath(p) {
    if (!p.length) return '';
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ` +
           `${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ` +
           `${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  // A knot: enters at the top of the circle, loops `loops` times, leaves at the bottom.
  // `mess` (0–1) controls how tangled it looks.
  function knot(pts, cx, cy, r, loops, mess, seed) {
    const rand = rng(seed);
    const total = Math.PI * 2 * loops + Math.PI;
    const steps = Math.max(10, Math.round(loops * 22 + 12));
    const ph = [rand() * 6, rand() * 6, rand() * 6, rand() * 6];
    const dir = rand() > .5 ? 1 : -1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const env = Math.pow(Math.sin(Math.PI * t), .6);       // 0 at both ends → exact entry/exit
      const a = -Math.PI / 2 + dir * total * t;
      const wob = 1 + env * mess * (0.16 * Math.sin(t * 23 + ph[0]) + 0.1 * Math.sin(t * 51 + ph[1]) + 0.14 * (rand() - .5));
      const dx = env * mess * r * 0.34 * (Math.sin(t * 6.3 + ph[2]) + 0.6 * Math.sin(t * 15.7 + ph[0]));
      const dy = env * mess * r * 0.28 * (Math.cos(t * 5.1 + ph[3]) + 0.6 * Math.sin(t * 13.3 + ph[1]));
      const ax = 1 + env * mess * 0.25 * Math.sin(t * 5 + ph[1]);   // drifting ellipse
      pts.push([cx + dx + Math.cos(a) * r * wob * ax, cy + dy + Math.sin(a) * r * wob]);
    }
  }

  // The last step: a loose hand-drawn squiggle, like the end of the reference drawing.
  function squiggle(pts, cx, cy, r) {
    const n = 40;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const y = cy - r + 2 * r * t;
      const x = cx + Math.sin(t * Math.PI * 3) * r * 0.55 * Math.sin(Math.PI * t);
      pts.push([x, y]);
    }
  }

  // A wandering line between two points. `jitter` adds the shaky hand of the early years.
  function wander(pts, a, b, amp, jitter, seed, W) {
    const rand = rng(seed);
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(3, Math.round(dist / (jitter > 0.2 ? 14 : 34)));
    const f = 0.6 + rand() * 1.1, ph = rand() * Math.PI * 2;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const env = Math.sin(Math.PI * t);
      const e = t * t * (3 - 2 * t);
      let x = a[0] + (b[0] - a[0]) * e + amp * env * Math.sin(t * Math.PI * 2 * f + ph);
      let y = a[1] + (b[1] - a[1]) * t;
      x += jitter * env * (rand() - .5) * 18;
      y += jitter * env * (rand() - .5) * 6;
      pts.push([clamp(x, 8, W - 8), y]);
    }
    pts.push(b);
  }

  /* ---------- state ---------- */
  let L = 0, samples = [], ball = null, introDone = reduce, introT = 0, cur = 0, lastBallU = -1;
  let mobile = false, built = false, nodeYs = [];

  function buildBall(u) {
    const loosen = reduce ? 0 : u;
    const pts = [];
    const { cx, cy, r } = ball;
    // tail from the small starting circle, into the top of the ball
    const s = [cx - r * 1.55, cy + r * 0.35];
    pts.push(s);
    pts.push([cx - r * 1.25, cy + r * 0.1], [cx - r * 0.9, cy - r * 0.55], [cx - r * 0.35, cy - r * 1.02]);
    pts.push([cx, cy - r]);
    knot(pts, cx, cy, r * (1 + loosen * 0.08), 11, 1 - loosen * 0.55, 7);
    ballPath.setAttribute('d', toPath(pts));
    startDot.setAttribute('cx', s[0]); startDot.setAttribute('cy', s[1]);
    lastBallU = u;
  }

  function build() {
    svg.setAttribute('height', 0); // so the old drawing doesn't stretch the page
    const W = document.documentElement.clientWidth;
    const H = document.documentElement.scrollHeight;
    mobile = innerWidth <= 760;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const b = box(ballAnchor);
    ball = { cx: b.x, cy: b.y, r: Math.min(b.w, b.h) * (mobile ? 0.3 : 0.33) };
    buildBall(heroProgress());

    const pts = [];
    let prev = [ball.cx, ball.cy + ball.r];
    pts.push(prev);

    // down the right side, past the method section, then sweep across to the timeline lane
    const m = box(method), sw = box(sweep);
    const rightX = mobile ? W - 18 : Math.max(ball.cx, W * 0.72);
    const laneX = box(items[0].querySelector('.node')).x;
    wander(pts, prev, [rightX, m.bottom], mobile ? 6 : 40, 0.9, 3, W);
    wander(pts, [rightX, m.bottom], [laneX, sw.bottom + 40], mobile ? 10 : 60, 0.8, 5, W);
    prev = pts[pts.length - 1];

    nodeYs = [];
    items.forEach((li, i) => {
      const n = box(li.querySelector('.node'));
      const loops = parseFloat(li.dataset.loops);
      const mess = parseFloat(li.dataset.mess);
      const seed = parseInt(li.dataset.seed, 10);
      const r = mobile ? 15 : 62 - i * 1.5;
      const top = [n.x, n.y - r];
      const prevMess = i ? parseFloat(items[i - 1].dataset.mess) : 0.9;
      const laneW = li.querySelector('.tl-lane').getBoundingClientRect().width;
      wander(pts, prev, top, mobile ? 4 : laneW * 0.28, prevMess, seed + 1, W);
      if (li.dataset.shape === 'squiggle') squiggle(pts, n.x, n.y, mobile ? 18 : 46);
      else knot(pts, n.x, n.y, r, loops, mess, seed);
      prev = [n.x, n.y + r];
      if (pts[pts.length - 1][1] !== prev[1]) pts.push(prev);
      nodeYs.push(n.y);
    });

    // the loose end runs on to the contact section and points at it
    const e = box(endAnchor);
    const bend = [e.x - (mobile ? 10 : 70), e.y - (mobile ? 40 : 120)];
    wander(pts, prev, bend, mobile ? 4 : 30, 0, 99, W);
    pts.push([e.x - (mobile ? 6 : 30), e.y - (mobile ? 8 : 22)]);
    pts.push([e.x, e.y]);

    threadPath.setAttribute('d', toPath(pts));
    L = threadPath.getTotalLength();
    threadPath.style.strokeDasharray = `${L} ${L}`;

    // arrowhead along the last segment
    const p1 = pts[pts.length - 2], p2 = pts[pts.length - 1];
    const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const s = mobile ? 9 : 14, sp = 0.5;
    const hx = (k) => (p2[0] - Math.cos(ang + k * sp) * s).toFixed(1);
    const hy = (k) => (p2[1] - Math.sin(ang + k * sp) * s).toFixed(1);
    arrow.setAttribute('d', `M${hx(1)},${hy(1)} L${p2[0].toFixed(1)},${p2[1].toFixed(1)} L${hx(-1)},${hy(-1)}`);

    // lookup table: how much thread is needed to reach a given page height
    samples = [];
    const step = 10;
    let maxY = -Infinity;
    for (let l = 0; l <= L; l += step) {
      const p = threadPath.getPointAtLength(l);
      maxY = Math.max(maxY, p.y);
      samples.push([l, maxY]);
    }
    samples.push([L, Math.max(maxY, threadPath.getPointAtLength(L).y)]);
    built = true;
    if (reduce) cur = L;
  }

  function lengthAtY(y) {
    let lo = 0, hi = samples.length - 1;
    if (y <= samples[0][1]) return 0;
    if (y >= samples[hi][1]) return L;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (samples[mid][1] < y) lo = mid + 1; else hi = mid; }
    return samples[lo][0];
  }

  function heroProgress() {
    const h = $('.hero').offsetHeight;
    return clamp(scrollY / (h * 0.9), 0, 1);
  }

  /* ---------- intro: draw the ball ---------- */
  function intro() {
    if (reduce) { document.body.classList.add('ready'); return; }
    const len = ballPath.getTotalLength();
    ballPath.style.strokeDasharray = `${len} ${len}`;
    ballPath.style.strokeDashoffset = len;
    startDot.style.opacity = 0;
    const t0 = performance.now(), dur = 2600;
    const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      startDot.style.opacity = t > 0.02 ? 1 : 0;
      const l = ballPath.getTotalLength();
      ballPath.style.strokeDasharray = `${l} ${l}`;
      ballPath.style.strokeDashoffset = l * (1 - ease(t));
      if (t < 1) requestAnimationFrame(step);
      else { ballPath.style.strokeDasharray = 'none'; ballPath.style.strokeDashoffset = 0; introDone = true; }
    };
    requestAnimationFrame(step);
    document.body.classList.add('ready');
  }

  /* ---------- frame loop ---------- */
  function frame() {
    if (built) {
      const u = heroProgress();
      document.body.classList.toggle('scrolled', scrollY > 20);
      if (Math.abs(u - lastBallU) > 0.002) buildBall(u);

      const target = introDone ? lengthAtY(scrollY + innerHeight * 0.62) : 0;
      cur += (target - cur) * (reduce ? 1 : 0.12);
      if (Math.abs(target - cur) < 0.5) cur = target;
      threadPath.style.strokeDashoffset = L - cur;

      if (cur > 1) {
        const p = threadPath.getPointAtLength(cur);
        tip.setAttribute('cx', p.x); tip.setAttribute('cy', p.y);
        tip.style.opacity = cur >= L - 1 ? 0 : 1;
      } else tip.style.opacity = 0;
      arrow.classList.toggle('on', cur >= L - 2);

      // year ticker
      const line = scrollY + innerHeight * 0.62;
      let idx = -1;
      nodeYs.forEach((y, i) => { if (y <= line) idx = i; });
      const tl = timeline.getBoundingClientRect();
      ticker.classList.toggle('on', idx >= 0 && tl.bottom > innerHeight * 0.5);
      if (idx >= 0) {
        tickYear.textContent = items[idx].dataset.year;
        tickBar.style.width = `${((idx + 1) / items.length) * 100}%`;
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- toolkit minis: a knot pulled straight ---------- */
  function minis() {
    $$('.mini').forEach((s, i) => {
      const pts = [[4, 24]];
      knot(pts, 30, 24, 15, 3.5 - i * 0.5, 0.9 - i * 0.12, 200 + i);
      pts.push([60, 30], [90, 24], [120, 24], [150, 24]);
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', toPath(pts));
      const h = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      h.setAttribute('d', 'M142,18 L151,24 L142,30');
      s.append(p, h);
      if (!reduce) {
        const l = p.getTotalLength();
        p.style.strokeDasharray = l; p.style.strokeDashoffset = l;
        p.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.6,.1,.2,1)';
        h.style.opacity = 0; h.style.transition = 'opacity .3s 1.4s';
        s._show = () => { p.style.strokeDashoffset = 0; h.style.opacity = 1; };
      }
    });
  }

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target._show) e.target._show();
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -18% 0px' });

  /* ---------- boot ---------- */
  let lastW = 0, rt = 0;
  function rebuild() {
    clearTimeout(rt);
    rt = setTimeout(build, 120);
  }

  function boot() {
    lastW = innerWidth;
    build();
    intro();
    minis();
    items.forEach((li) => io.observe(li));
    $$('.mini').forEach((m) => io.observe(m));
    requestAnimationFrame(frame);

    addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; rebuild(); } });
    // page height can change once images/fonts settle
    new ResizeObserver(rebuild).observe(document.body);
  }

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot);
})();
