/* ============================================================
   Infinite horizontal card slider — vanilla JS
   ------------------------------------------------------------
   This version fixes the two visible edge bugs:
     • no finite clamp at the right edge — clones create an endless feed
     • no abrupt active z-index override — z-order follows virtual order
       continuously, so every new card slides over the previous stack
   ============================================================ */

/* ---------- 1. Card data ---------- */
const CARDS = [
  { no: '№ 1.1', m1: '15-50 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '100%', s2: 'передоплата',
    desc: 'Тарифний план для споживачів із середньомісячним обсягом 15–50 МВт·год.' },
  { no: '№ 1.2', m1: '15-50 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '50%',  s2: 'передоплата', desc: '' },
  { no: '№ 2.1', m1: '50-150 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '100%', s2: 'передоплата', desc: '' },
  { no: '№ 2.2', m1: '50-150 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '50%',  s2: 'передоплата', desc: '' },
  { no: '№ 3.1', m1: '150+ МВт*год',   s1: 'середньомісячний обсяг споживання', m2: '100%', s2: 'передоплата', desc: '' },
  { no: '№ 3.2', m1: '150+ МВт*год',   s1: 'середньомісячний обсяг споживання', m2: '50%',  s2: 'передоплата', desc: '' },
];

/* ---------- 2. Motion / stacking tunables ---------- */
const REPEAT_SETS = 3;     // previous / current / next clone set
const CENTER_SET = 1;
const LERP = 0.13;
const ACTIVE_SCALE = 1.045;
const STACK = {
  maxDepth: 4.2,
  offsetX: 13,
  scaleStep: 0.055,
  opacityStep: 0.16,
  minOpacity: 0.22,
  parallax: 0.055,
};

const track = document.getElementById('track');
const tpl = document.getElementById('card-tpl');
const viewport = document.querySelector('.slider__viewport');
const fill = document.querySelector('.slider__progress-fill');
const nextBtns = document.querySelectorAll('.nav-btn--next');
const prevBtns = document.querySelectorAll('.nav-btn--prev');

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const wrap = (v, size) => ((v % size) + size) % size;
const lerpColor = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
const DARK = [56, 66, 75];
const GRAY = [140, 153, 160];

/* ---------- 3. Build real cards + clone sets ---------- */
const cards = [];

function createCard(data, baseIndex, setIndex) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.baseIndex = baseIndex;
  node.dataset.setIndex = setIndex;
  node.querySelector('.card__no').textContent = data.no;

  const metrics = node.querySelectorAll('.card__metric');
  metrics[0].querySelector('b').textContent = data.m1;
  metrics[0].querySelector('span').textContent = data.s1;
  metrics[1].querySelector('b').textContent = data.m2;
  metrics[1].querySelector('span').textContent = data.s2;

  const desc = node.querySelector('.card__desc');
  if (data.desc) desc.textContent = data.desc; else desc.remove();

  if (setIndex !== CENTER_SET) node.setAttribute('aria-hidden', 'true');
  track.appendChild(node);
  cards.push({
    el: node,
    inner: node.querySelector('.card__inner'),
    baseIndex,
    setIndex,
    virtualIndex: setIndex * CARDS.length + baseIndex,
  });
}

for (let set = 0; set < REPEAT_SETS; set += 1) {
  CARDS.forEach((card, index) => createCard(card, index, set));
}

/* ---------- 4. Geometry / infinite state ---------- */
let cardW = 0;
let step = 0;
let loopWidth = 1;
let viewportW = 0;
let stackSpan = 0;
let pos = 0;
let target = 0;

function readVar(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
}

function measure() {
  const oldLoop = loopWidth;
  const phase = oldLoop > 1 ? wrap(pos, oldLoop) : 0;

  // CSS can use min()/calc()/clamp() for responsive card width, so we
  // measure the rendered element. IMPORTANT: use offsetWidth (layout
  // width) and not getBoundingClientRect() — the latter is affected by
  // the live scale transform, which on resize would report a shrunken
  // stacked card and make the step (and thus the gap) collapse.
  cardW = cards[0]?.el.offsetWidth || readVar('--card-w');
  step = cardW + readVar('--gap');
  loopWidth = CARDS.length * step;
  viewportW = Math.max(window.innerWidth, viewport.getBoundingClientRect().width);
  stackSpan = step * STACK.maxDepth;

  pos = loopWidth * CENTER_SET + phase;
  target = pos;
}

function normalizeLoop() {
  while (target >= loopWidth * (CENTER_SET + 1)) {
    target -= loopWidth;
    pos -= loopWidth;
  }
  while (target < loopWidth * CENTER_SET) {
    target += loopWidth;
    pos += loopWidth;
  }
}

/* ---------- 5. Continuous card transform calculation ---------- */
function getCardState(rawX) {
  let x = rawX;
  let scaleX = 1;
  let scaleY = 1;
  let opacity = 1;
  let parallax = rawX * STACK.parallax;

  if (rawX < 0) {
    // Stacked cards shrink uniformly as they pile up on the left.
    const depth = clamp(-rawX / step, 0, STACK.maxDepth);
    x = -depth * STACK.offsetX;
    scaleX = scaleY = 1 - depth * STACK.scaleStep;
    opacity = Math.max(1 - depth * STACK.opacityStep, STACK.minOpacity);
    parallax = 0;
  } else {
    // Flowing cards keep their full WIDTH, so the 5px gap between cards
    // stays exact on every device. The active (left-edge) card only
    // grows in HEIGHT to stand out — that never eats the spacing.
    const focus = 1 - clamp(rawX / step, 0, 1);
    scaleY = 1 + focus * (ACTIVE_SCALE - 1);
  }

  const farRight = rawX > viewportW + cardW * 2;
  const farLeft = rawX < -stackSpan - cardW;

  return {
    x,
    scaleX,
    scaleY,
    opacity: farRight || farLeft ? 0 : opacity,
    // Deck rule: the closer a card is to the left (active) edge, the
    // higher it sits. So the selected green card is always on top and
    // every card to the right slides UNDER the previous one, keeping
    // the right-hand cards' text readable. Continuous distance => no
    // sudden z-index jumps.
    z: Math.round(1e6 - Math.abs(rawX)),
    parallax,
  };
}

function render() {
  const activeVirtual = Math.round(pos / step);
  const activeBase = wrap(activeVirtual, CARDS.length);
  const phase = wrap(pos, loopWidth);

  cards.forEach((card) => {
    const rawX = card.virtualIndex * step - pos;
    const state = getCardState(rawX);
    const isActive = card.baseIndex === activeBase && Math.abs(rawX) < step / 2;

    card.el.classList.toggle('is-active', isActive);
    if (isActive) {
      card.el.style.background = '';
    } else {
      const depthTint = rawX >= 0 ? clamp(rawX / (step * 4), 0, 1) : 0;
      const [r, g, b] = lerpColor(DARK, GRAY, depthTint);
      card.el.style.background = `rgb(${r}, ${g}, ${b})`;
    }

    card.el.style.transform = `translate3d(${state.x}px, 0, 0) scale3d(${state.scaleX}, ${state.scaleY}, 1)`;
    card.el.style.opacity = state.opacity;
    card.el.style.zIndex = state.z;
    card.inner.style.transform = `translate3d(${state.parallax}px, 0, 0)`;
  });

  if (fill) fill.style.width = `${(phase / loopWidth) * 100}%`;
  prevBtns.forEach((btn) => (btn.disabled = false));
  nextBtns.forEach((btn) => (btn.disabled = false));
}

function tick() {
  normalizeLoop();
  pos += (target - pos) * LERP;
  if (Math.abs(target - pos) < 0.03) pos = target;
  render();
  requestAnimationFrame(tick);
}

/* ---------- 6. Navigation / snapping ---------- */
function snap() {
  target = Math.round(target / step) * step;
}

function nudge(dir) {
  target = Math.round(target / step) * step + dir * step;
}

let lastWheelStepAt = 0;
viewport.addEventListener('wheel', (e) => {
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  e.preventDefault();

  // One physical mouse-wheel notch should move exactly one card.
  // Browsers often emit several wheel events per notch, so the small
  // cooldown prevents accidental jumps across multiple cards.
  const now = performance.now();
  if (Math.abs(delta) < 1 || now - lastWheelStepAt < 260) return;

  nudge(delta > 0 ? 1 : -1);
  lastWheelStepAt = now;
}, { passive: false });

let dragging = false;
let startX = 0;
let startTarget = 0;
let lastX = 0;
let lastT = 0;
let velocity = 0;

track.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button')) return;
  dragging = true;
  startX = lastX = e.clientX;
  startTarget = target;
  lastT = performance.now();
  velocity = 0;
  track.classList.add('is-dragging');
  track.setPointerCapture(e.pointerId);
});

track.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - startX;
  target = startTarget - dx;

  const now = performance.now();
  const dt = now - lastT || 16;
  velocity = (e.clientX - lastX) / dt;
  lastX = e.clientX;
  lastT = now;
});

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  track.classList.remove('is-dragging');
  try { track.releasePointerCapture(e.pointerId); } catch (_) {}
  target -= velocity * 240;
  snap();
}

track.addEventListener('pointerup', endDrag);
track.addEventListener('pointercancel', endDrag);
nextBtns.forEach((btn) => btn.addEventListener('click', () => nudge(1)));
prevBtns.forEach((btn) => btn.addEventListener('click', () => nudge(-1)));

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') nudge(1);
  if (e.key === 'ArrowLeft') nudge(-1);
});

window.addEventListener('resize', measure);
measure();
requestAnimationFrame(tick);
