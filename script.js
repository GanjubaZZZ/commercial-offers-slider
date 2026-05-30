const CARDS = [
  { no: '№ 1.1', m1: '15-50 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '100%', s2: 'передоплата',
    desc: 'Тарифний план для споживачів із середньомісячним обсягом 15–50 МВт·год.' },
  { no: '№ 1.2', m1: '15-50 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '50%',  s2: 'передоплата', desc: '' },
  { no: '№ 2.1', m1: '50-150 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '100%', s2: 'передоплата', desc: '' },
  { no: '№ 2.2', m1: '50-150 МВт*год', s1: 'середньомісячний обсяг споживання', m2: '50%',  s2: 'передоплата', desc: '' },
  { no: '№ 3.1', m1: '150+ МВт*год',   s1: 'середньомісячний обсяг споживання', m2: '100%', s2: 'передоплата', desc: '' },
  { no: '№ 3.2', m1: '150+ МВт*год',   s1: 'середньомісячний обсяг споживання', m2: '50%',  s2: 'передоплата', desc: '' },
];

const LERP = 0.13;
const STACK = {
  offsetX: 18,
  parallax: 0.055,
};

const track = document.getElementById('track');
const tpl = document.getElementById('card-tpl');
const viewport = document.querySelector('.slider__viewport');
const fill = document.querySelector('.slider__progress-fill');
const nextBtns = document.querySelectorAll('.nav-btn--next');
const prevBtns = document.querySelectorAll('.nav-btn--prev');

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

const TONE_CLASSES = [
  'is-flow-1', 'is-flow-2', 'is-flow-3', 'is-flow-4',
  'is-stack-1', 'is-stack-2', 'is-stack-3', 'is-stack-4', 'is-stack-5', 'is-stack-6',
];

function clearToneClasses(el) {
  el.classList.remove(...TONE_CLASSES);
}

const cards = CARDS.map((data, index) => {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.card__no').textContent = data.no;

  const metrics = node.querySelectorAll('.card__metric');
  metrics[0].querySelector('b').textContent = data.m1;
  metrics[0].querySelector('span').textContent = data.s1;
  metrics[1].querySelector('b').textContent = data.m2;
  metrics[1].querySelector('span').textContent = data.s2;

  const desc = node.querySelector('.card__desc');
  if (data.desc) desc.textContent = data.desc; else desc.remove();

  track.appendChild(node);
  return { el: node, inner: node.querySelector('.card__inner'), index };
});

const DESKTOP_MQ = window.matchMedia('(min-width: 1024px)');
const TABLET_MQ = window.matchMedia('(min-width: 601px) and (max-width: 1023px)');
const PHONE_MQ = window.matchMedia('(max-width: 600px)');

let cardW = 0;
let step = 0;
let maxScroll = 0;
let viewportW = 0;
let pos = 0;
let target = 0;

function readVar(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
}

function measure() {
  const ratio = maxScroll > 0 ? clamp(pos / maxScroll, 0, 1) : 0;

  cardW = cards[0]?.el.offsetWidth || readVar('--card-w');
  step = cardW + readVar('--gap');
  maxScroll = Math.max(0, (cards.length - 1) * step);
  viewportW = viewport.clientWidth;

  pos = maxScroll * ratio;
  target = clamp(target, 0, maxScroll);
  pos = clamp(pos, 0, maxScroll);
}

function getCardState(rawX) {
  let x = rawX;
  let parallax = rawX * STACK.parallax;
  let stackLevel = 0;
  let flowLevel = 0;

  if (rawX < 0) {
    if (PHONE_MQ.matches) {
      x = 0;
      parallax = 0;
    } else if (DESKTOP_MQ.matches) {
      const depth = -rawX / step;
      x = -depth * STACK.offsetX;
      stackLevel = clamp(Math.ceil(depth), 1, 6);
      parallax = 0;
    } else {
      x = rawX;
      parallax = 0;
    }
  } else {
    flowLevel = clamp(Math.ceil(rawX / step), 1, 4);
  }

  let opacity = 1;
  if (PHONE_MQ.matches || TABLET_MQ.matches) {
    if (x + cardW <= 0 || x >= viewportW) opacity = 0;
    parallax = 0;
  }

  return {
    x,
    opacity,
    z: Math.round(1e6 - Math.abs(rawX)),
    parallax,
    stackLevel,
    flowLevel,
  };
}

function render() {
  const activeIndex = clamp(Math.round(pos / step), 0, cards.length - 1);

  cards.forEach((card) => {
    const rawX = card.index * step - pos;
    const state = getCardState(rawX);
    const isActive = card.index === activeIndex && Math.abs(rawX) < step / 2;
    const highlightActive = isActive && !TABLET_MQ.matches;

    card.el.classList.toggle('is-active', highlightActive);
    card.el.classList.toggle('is-stacked', state.stackLevel > 0 && !highlightActive);
    clearToneClasses(card.el);
    if (!highlightActive) {
      if (state.stackLevel > 0) card.el.classList.add(`is-stack-${state.stackLevel}`);
      else if (state.flowLevel > 0) card.el.classList.add(`is-flow-${state.flowLevel}`);
    }

    card.el.style.transform = `translate3d(${state.x}px, 0, 0)`;
    card.el.style.opacity = state.opacity;
    card.el.style.zIndex = state.z;
    card.inner.style.transform = `translate3d(${state.parallax}px, 0, 0)`;
  });

  if (fill) fill.style.width = `${maxScroll ? (pos / maxScroll) * 100 : 0}%`;

  const atStart = pos <= 0.5;
  const atEnd = pos >= maxScroll - 0.5;
  prevBtns.forEach((btn) => (btn.disabled = atStart));
  nextBtns.forEach((btn) => (btn.disabled = atEnd));
}

function tick() {
  pos += (target - pos) * LERP;
  if (Math.abs(target - pos) < 0.03) pos = target;
  render();
  requestAnimationFrame(tick);
}

function snap() {
  target = clamp(Math.round(target / step) * step, 0, maxScroll);
}

function nudge(dir) {
  target = clamp(Math.round(target / step) * step + dir * step, 0, maxScroll);
}

let lastWheelStepAt = 0;
viewport.addEventListener('wheel', (e) => {
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const next = clamp(target + (delta > 0 ? step : -step), 0, maxScroll);
  if (next === target) return;

  e.preventDefault();
  const now = performance.now();
  if (now - lastWheelStepAt < 260) return;

  target = next;
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
  target = clamp(startTarget - (e.clientX - startX), 0, maxScroll);

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
  target = clamp(target - velocity * 240, 0, maxScroll);
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
