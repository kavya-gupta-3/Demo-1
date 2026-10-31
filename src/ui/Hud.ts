import { gsap } from 'gsap';
import { STAGES } from '../data/content';
import { ageOn, educationOn } from '../data/profile';
import { $, $$ } from './dom';

const THREAT = [0.92, 0.45, 0.8, 0.62, 0.86, 0.7, 1];
const istTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/**
 * The heads-up display: accent theming per dragon, nav + spine state,
 * live readouts (altitude, depth, fps, IST clock) and the specimen card.
 */
export class Hud {
  private stage = -1;
  private readonly navLinks = $$<HTMLAnchorElement>('[data-goto]');
  private readonly els = {
    sector: $('#ro-sector'),
    alt: $('#ro-alt'),
    depth: $('#ro-scroll'),
    fps: $('#ro-fps'),
    time: $('#ro-time'),
    signal: $('#ro-signal'),
    num: $('#sp-num'),
    cls: $('#sp-class'),
    name: $('#sp-name'),
    epithet: $('#sp-epithet'),
    element: $('#sp-element'),
    threat: $('#sp-threat'),
    lore: $('#sp-lore'),
    spine: $('#spine-fill'),
    theme: $<HTMLMetaElement>('meta[name="theme-color"]'),
  };
  private lastWrite = 0;
  private compactTimer = 0;
  private readonly card = $('#specimen');

  constructor() {
    this.fillTicker();
    const clock = () => {
      if (this.els.time) this.els.time.textContent = istTime.format(new Date());
    };
    clock();
    window.setInterval(clock, 1000);
  }

  private fillTicker() {
    const track = $('#ticker');
    if (!track) return;
    const now = new Date();
    const edu = educationOn(now);
    const items = [
      ['KG-OS', 'v7.0 · seven dragons online'],
      ['AGE', String(ageOn(now))],
      ['STUDY', edu.short],
      ['TIMETABLE', 'not found — by design'],
      ['EARNED', '₹200K+ before 18'],
      ['BGMI WOW', 'won ×2'],
      ['CLASSES TAKEN', '0 — all self-taught'],
      ['TIP', 'press ⌘K / CTRL+K for commands'],
      ['TIP', 'click empty space to provoke a dragon'],
      ['SECRET', '↑ ↑ ↓ ↓ ← → ← → B A'],
    ];
    const html = items.map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('');
    track.innerHTML = html + html;
  }

  setStage(i: number) {
    if (i === this.stage) return;
    this.stage = i;
    const s = STAGES[i];
    document.documentElement.dataset.stage = String(i);
    this.els.theme?.setAttribute('content', '#060509');
    for (const a of this.navLinks) a.classList.toggle('is-active', Number(a.dataset.goto) === i);
    const e = this.els;
    if (e.sector) e.sector.textContent = `${String(i + 1).padStart(2, '0')}/07`;
    if (e.num) e.num.textContent = String(i + 1).padStart(2, '0');
    const scramble = (el: HTMLElement | null, text: string, d = 0.8) => {
      if (!el) return;
      gsap.to(el, { duration: d, scrambleText: { text, chars: 'upperCase', speed: 0.5 }, ease: 'none' });
    };
    scramble(e.name, s.dragon, 0.9);
    scramble(e.cls, s.classification.toUpperCase(), 0.7);
    scramble(e.element, s.element.toUpperCase(), 0.6);
    if (e.epithet) e.epithet.textContent = s.epithet;
    if (e.lore) e.lore.textContent = s.lore;
    e.threat?.parentElement?.style.setProperty('--t', String(THREAT[i]));
    e.threat?.style.setProperty('--t', String(THREAT[i]));
    // the full card shows on arrival, then folds into a chip out of the content's way
    this.card?.classList.remove('is-compact');
    window.clearTimeout(this.compactTimer);
    this.compactTimer = window.setTimeout(() => this.card?.classList.add('is-compact'), 5200);
  }

  update(progress: number, altitude: number, fps: number, time: number) {
    if (time - this.lastWrite < 0.1) return;
    this.lastWrite = time;
    const e = this.els;
    if (e.alt) e.alt.textContent = (altitude * 10).toFixed(1).padStart(6, '0');
    if (e.depth) e.depth.textContent = (progress * 100).toFixed(1).padStart(5, '0');
    if (e.fps) e.fps.textContent = String(Math.round(fps));
    e.spine?.style.setProperty('--p', progress.toFixed(4));
  }

  signal(text: string) {
    if (this.els.signal) this.els.signal.textContent = text;
  }
}
