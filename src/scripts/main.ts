/**
 * Behaviour and motion. The page reads fine without this script; with it,
 * the particle field assembles her portrait and morphs scene by scene,
 * the journey and expertise scenes step with the scroll, and type rises
 * into place. Reduced motion keeps the interactions and drops the movement.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { createField, toScreen, type Field, type ShapeName } from './particles';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const html = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const EASE = 'expo.out';
const fontsReady = () => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2200))]);

/* ───────────────────────── Smooth scroll ───────────────────────── */
let lenis: Lenis | null = null;
function smooth() {
  if (reduced) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollTo(target: HTMLElement | number) {
  // Land exactly on the section's top (not offset by the page's scroll-padding), so
  // the pinned scenes start from their first step.
  const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
  if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
}
function anchors() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.closest('dialog')) return;
    const id = a.getAttribute('href')!;
    const el = id === '#top' ? null : $(id);
    if (id !== '#top' && !el) return;
    e.preventDefault();
    scrollTo(el ?? 0);
    history.replaceState(null, '', id);
  });
}

/* ───────────────────────── Intro ───────────────────────── */
function intro(): Promise<void> {
  const el = $('[data-intro]');
  if (!html.classList.contains('has-intro') || !el) return Promise.resolve();
  try { sessionStorage.setItem('ledger-intro', '1'); } catch { /* private mode */ }
  const count = $('[data-intro-count]', el)!;
  const bar = $('[data-intro-bar]', el)!;
  const state = { v: 0 };
  const render = () => { count.textContent = String(Math.round(state.v)).padStart(3, '0'); bar.style.transform = `scaleX(${state.v / 100})`; };
  gsap.from($('.intro__word', el), { yPercent: 100, opacity: 0, duration: 1, ease: EASE });
  const run = gsap.to(state, { v: 86, duration: 1.1, ease: 'power2.inOut', onUpdate: render });
  return Promise.all([fontsReady(), new Promise((r) => setTimeout(r, 1100))]).then(
    () => new Promise<void>((done) => {
      run.kill();
      gsap.timeline({ onComplete: () => { html.classList.remove('has-intro'); el.remove(); } })
        .to(state, { v: 100, duration: 0.35, ease: 'power1.out', onUpdate: render })
        .to('.intro__inner', { yPercent: -12, opacity: 0, duration: 0.5, ease: 'power3.in' }, '+=0.05')
        .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '-=0.2')
        .add(() => done(), '-=0.55');
    }),
  );
}

/* ───────────────────────── Type reveals ───────────────────────── */
function chars(el: HTMLElement, delay = 0, scroll = true) {
  // No overflow masks: letters rise and fade, so tall glyphs are never clipped.
  const split = SplitText.create(el, { type: 'words,chars', charsClass: 'char', wordsClass: 'word' });
  gsap.from(split.chars, {
    yPercent: 60, opacity: 0, rotateX: -50, transformOrigin: '50% 100%', duration: 1.2, ease: EASE, stagger: 0.035, delay,
    scrollTrigger: scroll ? { trigger: el, start: 'top 88%', once: true } : undefined,
  });
}
function reveals(heroDelay: number) {
  const hero = $('[data-hero]');
  if (hero) {
    $$('.js-chars', hero).forEach((el, i) => chars(el, heroDelay + 0.5 + i * 0.16, false));
    gsap.from($$('.js-fade', hero), { y: 18, opacity: 0, duration: 1, ease: EASE, stagger: 0.09, delay: heroDelay + 1.1 });
  }
  const outside = (el: Element) => !hero?.contains(el);
  $$('.js-chars').filter(outside).forEach((el) => chars(el));
  $$('.js-lines').filter(outside).forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 105, duration: 1.1, ease: EASE, stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 90%', once: true } }),
    });
  });
  $$('.js-fade').filter(outside).forEach((el) => gsap.from(el, { y: 18, opacity: 0, duration: 1, ease: EASE, scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
  $$('.js-stagger').forEach((el) => gsap.from(el.children, { y: 40, opacity: 0, duration: 1.1, ease: EASE, stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 85%', once: true } }));

  // The thesis inks in word by word as it is read.
  const thesis = $('[data-ink]');
  if (thesis) gsap.fromTo($$('.w', thesis), { opacity: 0.1 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: thesis, start: 'top 85%', end: 'top 30%', scrub: true } });
}

/* ───────────────────────── The particle field ───────────────────────── */
let field: Field | null = null;
async function startField(heroDelay: number) {
  const canvas = $<HTMLCanvasElement>('[data-field]');
  if (!canvas) return;
  field = await createField(canvas, canvas.dataset.src!, { nodes: Number(canvas.dataset.nodes) || 7, theme: html.dataset.theme === 'dark' ? 'dark' : 'light', weights: (canvas.dataset.weights ?? '').split(',').map(Number).filter((x) => !isNaN(x)), reduced }).catch(() => null);
  if (!field) { html.classList.add('no-field'); canvas.remove(); return; }
  const f = field;

  // Her real photo sits exactly where the particle portrait forms. Once the
  // particles have assembled they resolve into it at full sharpness; on
  // scroll it hands back to the particles, which then fly to the next shape.
  const crisp = $<HTMLImageElement>('[data-crisp]');
  const spot = $('[data-spot]');
  const hand = { ready: reduced ? 1 : 0, start: 1, end: 0, hover: 0, which: 'start' as 'start' | 'end' };
  const paint = () => {
    if (!crisp) return;
    const which = hand.end > 0 ? 'end' : 'start';
    if (which !== hand.which) { hand.which = which; box(); }
    const o = Math.max(hand.ready * hand.start, hand.end) * (1 - hand.hover);
    crisp.style.opacity = String(o);
    if (spot) spot.style.opacity = String(Math.max(hand.ready * hand.start, hand.end));
    f.fade(1 - o);
  };
  const box = () => {
    if (!crisp) return;
    const b = f.portraitBox(hand.which);
    crisp.style.width = crisp.style.height = `${b.size}px`;
    crisp.style.transform = `translate(${b.x - b.size / 2}px, ${b.y - b.size / 2}px)`;
    if (spot) { const d = b.size * 1.55; spot.style.width = spot.style.height = `${d}px`; spot.style.transform = `translate(${b.x - d / 2}px, ${b.y - d / 2 - b.size * 0.05}px)`; }
  };
  f.onLayout(box);
  // The photo stays sharp when the pointer is over it. (An earlier version swapped it for the
  // rougher particle portrait on hover; on some browsers and screens that looked blocky.)
  const topFade = () => { hand.start = 1 - Math.min(1, scrollY / (innerHeight * 0.09)); paint(); };
  addEventListener('scroll', topFade, { passive: true });
  topFade();

  // Opening: dust gathers into her portrait.
  if (reduced) { f.setMorph('dust', 'portrait', 1); paint(); }
  else {
    f.setMorph('dust', 'portrait', 0);
    f.reveal(1.6, heroDelay);
    const s = { m: 0 };
    gsap.to(s, {
      m: 1, duration: 3.4, ease: 'power2.inOut', delay: heroDelay + 0.1,
      onUpdate: () => { if (scrollY < innerHeight * 0.15) f.setMorph('dust', 'portrait', s.m); },
      onComplete: () => gsap.to(hand, { ready: 1, duration: 1.1, ease: 'power2.inOut', onUpdate: paint }),
    });
  }

  // Each scene morphs the field from the previous scene's shape into its own.
  const scenes = $$('[data-scene]');
  scenes.forEach((sec, i) => {
    if (i === 0) return;
    const from = scenes[i - 1].dataset.scene as ShapeName;
    const to = sec.dataset.scene as ShapeName;
    ScrollTrigger.create({
      trigger: sec, start: 'top 90%', end: 'top 12%', scrub: true,
      onUpdate: (self) => {
        f.setMorph(from, to, self.progress);
        if (to === 'portraitEnd') { hand.end = Math.max(0, (self.progress - 0.93) / 0.07); paint(); }
      },
    });
  });

  // Phones: where long text scrolls across the field, the field steps back
  // so the words stay easy to read.
  if (innerWidth < 900) {
    const d = { v: 1 };
    const to = (v: number) => gsap.to(d, { v, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: () => f.dim(d.v) });
    $$('[data-dim]').forEach((sec) => ScrollTrigger.create({
      trigger: sec, start: 'top 38%', end: 'bottom 85%',
      onToggle: (self) => to(self.isActive ? 0.22 : 1),
    }));
  }

  // Journey: one step per role. The matching cluster on the path lights up.
  const jr = $('[data-journey]');
  if (jr) {
    const cards = $$('[data-step]', jr);
    const dots = $$('[data-node]', jr);
    const place = () => dots.forEach((d, i) => { const p = f.anchors.path[i]; if (!p) return; const s = toScreen(p); d.style.left = `${s.left}px`; d.style.top = `${s.top}px`; d.dataset.side = s.left > innerWidth * 0.55 ? 'l' : 'r'; });
    f.onLayout(place);
    let active = -1;
    const set = (i: number) => {
      if (i === active) return;
      active = i;
      cards.forEach((c, k) => { c.classList.toggle('is-on', k === i); c.classList.toggle('is-past', k < i); });
      dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
      f.highlight(i);
    };
    ScrollTrigger.create({
      trigger: jr, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { set(Math.min(cards.length - 1, Math.floor(self.progress * cards.length))); jr.style.setProperty('--p', String(self.progress)); },
      onToggle: (self) => { jr.classList.toggle('is-live', self.isActive); if (self.isActive) { active = -1; set(Math.min(cards.length - 1, Math.floor(self.progress * cards.length))); } else f.highlight(-1); },
    });
  }

  // Expertise: one step per petal. Each petal's own callout opens beside it
  // as it comes into view; the numbered markers and keys also select one.
  const bloom = $('[data-bloom]');
  if (bloom) {
    const items = $$('[data-petal-item]', bloom);
    const tips = $$('[data-petal]', bloom);
    const place = () => items.forEach((it, i) => {
      const p = f.anchors.petals[i]; if (!p) return;
      const s = toScreen(p);
      const tip = tips[i];
      [it, tip].forEach((el) => { if (!el) return; el.style.setProperty('--x', `${s.left}px`); el.style.setProperty('--y', `${s.top}px`); });
      it.dataset.side = s.left < innerWidth / 2 - 24 ? 'left' : 'right';
      it.dataset.vert = s.top > innerHeight * 0.58 ? 'up' : 'down';
      // The top petal sits above its neighbours' tips, so its note steps out
      // past them instead of resting on them.
      const top = Math.abs(s.left - innerWidth / 2) < innerWidth * 0.06;
      it.style.setProperty('--off', top ? `${Math.round(Math.max(110, innerWidth * 0.2))}px` : '84px');
    });
    f.onLayout(place);
    let live = false;
    const set = (i: number) => {
      items.forEach((c, k) => c.classList.toggle('is-on', k === i));
      tips.forEach((t, k) => t.classList.toggle('is-on', k === i));
      if (live) f.highlight(i);
    };
    let scrolled = 0;
    ScrollTrigger.create({
      trigger: bloom, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { const i = Math.min(items.length - 1, Math.floor(self.progress * items.length)); if (i !== scrolled) { scrolled = i; set(i); } },
      onToggle: (self) => { live = self.isActive; bloom.classList.toggle('is-live', live); if (live) set(scrolled); else f.highlight(-1); },
    });
    tips.forEach((t, i) => {
      if (fine) t.addEventListener('pointerenter', () => set(i));
      t.addEventListener('click', () => set(i));
    });
  }
  // Education: one credential per step, a ring lights for each.
  const learn = $('[data-learn]');
  if (learn) {
    const items = $$('[data-learn-item]', learn);
    const ticks = $$('[data-learn-tick]', learn);
    let live = false, scrolled = 0;
    const set = (i: number) => {
      items.forEach((c, k) => { c.classList.toggle('is-on', k === i); c.classList.toggle('is-past', k < i); });
      ticks.forEach((t, k) => t.classList.toggle('is-on', k === i));
      if (live) f.highlight(i);
    };
    ScrollTrigger.create({
      trigger: learn, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { const i = Math.min(items.length - 1, Math.floor(self.progress * items.length)); if (i !== scrolled) { scrolled = i; set(i); } },
      onToggle: (self) => { live = self.isActive; if (live) set(scrolled); else f.highlight(-1); },
    });
    ticks.forEach((t, i) => t.addEventListener('click', () => set(i)));
  }
  ScrollTrigger.refresh();
}

/* ───────────────────────── Cursor + magnetic ───────────────────────── */
function cursor() {
  const ring = $('[data-cursor-ring]');
  const dot = $('[data-cursor-dot]');
  const label = $('[data-cursor-label]');
  if (!fine || reduced || !ring || !dot) return;
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'none' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'none' });
  let magnet: HTMLElement | null = null;
  const release = () => { if (magnet) gsap.to(magnet, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }); magnet = null; };
  addEventListener('pointermove', (e) => {
    html.classList.add('has-cursor');
    rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    const t = e.target instanceof Element ? e.target : null;
    const labelled = t?.closest<HTMLElement>('[data-cursor]');
    ring.classList.toggle('is-label', !!labelled);
    ring.classList.toggle('is-hover', !labelled && !!t?.closest('a, button'));
    if (labelled && label) label.textContent = labelled.dataset.cursor ?? '';
    const m = t?.closest<HTMLElement>('[data-magnetic]') ?? null;
    if (m !== magnet) release();
    if (m) {
      magnet = m;
      const r = m.getBoundingClientRect();
      const k = Number(m.dataset.magnetic) || 0.3;
      gsap.to(m, { x: (e.clientX - (r.left + r.width / 2)) * k, y: (e.clientY - (r.top + r.height / 2)) * k, duration: 0.4, ease: 'power3.out' });
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { html.classList.remove('has-cursor'); release(); });
}

/* ───────────────────────── Header: current section + progress ───────────────────────── */
function header() {
  const no = $('[data-folio-no]');
  const name = $('[data-folio-name]');
  const progress = $('[data-progress]');
  const names = new Map($$('[data-index-link]').map((a) => [a.getAttribute('href')!.slice(1), a.querySelector('.index__name')!.textContent!]));
  let current = '';
  const set = (sec: HTMLElement) => {
    if (sec.id === current || !no || !name) return;
    current = sec.id;
    $$('[data-index-link]').forEach((l) => l.classList.toggle('is-current', l.getAttribute('href') === `#${sec.id}`));
    gsap.to(name, {
      yPercent: -100, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => {
        no.textContent = sec.dataset.folio ?? '';
        name.textContent = names.get(sec.id) ?? 'Opening';
        gsap.fromTo(name, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
      },
    });
  };
  const io = new IntersectionObserver((list) => list.forEach((en) => en.isIntersecting && set(en.target as HTMLElement)), { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-folio]').forEach((s) => io.observe(s));
  const onScroll = () => { const max = html.scrollHeight - innerHeight; progress?.style.setProperty('--p', String(max > 0 ? scrollY / max : 0)); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ───────────────────────── Portrait menu ───────────────────────── */
function menu() {
  const dlg = $<HTMLDialogElement>('[data-index]');
  const open = $('[data-index-open]');
  if (!dlg || !open) return;
  const note = $('[data-pm-note]', dlg);
  const no = $('[data-pm-no]', dlg);
  const photo = $('[data-pm-photo]', dlg);
  const links = $$('[data-index-link]', dlg);
  const idle = note?.textContent ?? '';
  const origin = () => { const r = open.getBoundingClientRect(); return `${r.left + r.width / 2}px ${r.top + r.height / 2}px`; };
  const show = () => {
    dlg.showModal();
    lenis?.stop();
    open.setAttribute('aria-expanded', 'true');
    if (reduced) return;
    const at = origin();
    gsap.timeline()
      .fromTo(dlg, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 1, ease: 'expo.inOut' })
      .from(photo, { clipPath: 'inset(100% 0 0 0)', duration: 1.1, ease: 'expo.inOut' }, 0.3)
      .from(links.map((l) => $('.pm__roll', l)), { yPercent: 100, opacity: 0, duration: 0.9, ease: EASE, stagger: 0.05 }, 0.45);
  };
  const hide = () => {
    if (reduced) { dlg.close(); return; }
    gsap.to(dlg, { clipPath: `circle(0% at ${origin()})`, duration: 0.7, ease: 'expo.inOut', onComplete: () => { dlg.close(); gsap.set(dlg, { clearProps: 'clipPath' }); } });
  };
  open.addEventListener('click', show);
  // A section chosen in the menu is scrolled to only once the menu has really closed
  // and smooth scrolling is running again; asking earlier is silently ignored.
  let pending: string | null = null;
  dlg.addEventListener('close', () => {
    lenis?.start();
    open.setAttribute('aria-expanded', 'false');
    const id = pending; pending = null;
    if (id) {
      const el = $(id);
      if (el) requestAnimationFrame(() => scrollTo(el));
    } else open.focus();
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); hide(); });
  $('[data-index-close]', dlg)?.addEventListener('click', hide);
  links.forEach((a) => {
    const say = () => {
      if (!note || !no) return;
      gsap.to(note, { yPercent: -40, opacity: 0, duration: 0.18, onComplete: () => {
        note.textContent = a.dataset.note ?? '';
        no.textContent = a.dataset.no ?? '';
        gsap.fromTo(note, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
      } });
    };
    a.addEventListener('pointerenter', say);
    a.addEventListener('focus', say);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('href')!;
      pending = id;
      hide();
      history.replaceState(null, '', id);
    });
  });
  $('.pm__list', dlg)?.addEventListener('pointerleave', () => { if (note && no) { note.textContent = idle; no.textContent = '00'; } });
}

/* ───────────────────────── Theme ───────────────────────── */
function theme() {
  const buttons = $$('[data-theme-toggle]');
  const meta = document.querySelector('meta[name="theme-color"]');
  const current = (): 'light' | 'dark' => (html.dataset.theme === 'dark' ? 'dark' : 'light');
  const label = (t: 'light' | 'dark') => buttons.forEach((b) => {
    b.setAttribute('aria-pressed', String(t === 'dark'));
    b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  });
  const apply = (t: 'light' | 'dark', save: boolean) => {
    html.dataset.theme = t;
    meta?.setAttribute('content', t === 'dark' ? '#0f0c10' : '#f7f3ec');
    label(t);
    if (save) { try { localStorage.setItem('theme', t); } catch { /* private mode */ } }
    field?.setTheme(t);
  };
  label(current());
  buttons.forEach((b) => b.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (vt && !reduced) vt.call(document, () => apply(next, true)); else apply(next, true);
  }));
  // Follow the system setting until she picks one herself.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    try { if (localStorage.getItem('theme')) return; } catch { /* ignore */ }
    apply(e.matches ? 'dark' : 'light', false);
  });
}

/* ───────────────────────── Copy email ───────────────────────── */
function copy() {
  $$<HTMLButtonElement>('[data-copy]').forEach((b) => {
    const idle = b.textContent;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy!); b.textContent = 'Copied ✓'; }
      catch {
        const span = $('[data-email]');
        if (span) { const r = document.createRange(); r.selectNodeContents(span); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); }
        b.textContent = 'Selected';
      }
      window.setTimeout(() => (b.textContent = idle), 2000);
    });
  });
}

/* ───────────────────────── Boot ───────────────────────── */
anchors();
header();
menu();
copy();
theme();

if (reduced) {
  html.classList.remove('m-wait', 'has-intro');
  startField(0);
} else {
  smooth();
  cursor();
  const playing = html.classList.contains('has-intro');
  const delay = playing ? 1.75 : 0.15;
  fontsReady().then(() => {
    reveals(delay);
    html.classList.remove('m-wait');
    intro();
    startField(delay);
  });
  addEventListener('load', () => ScrollTrigger.refresh());
}
