import { gsap } from 'gsap';
import { $ } from './dom';

/**
 * The boot screen. Progress is real: each line in the log is a step that
 * actually ran (worker meshing, shader compilation, fonts…).
 */
export class Loader {
  private readonly root = $('#loader');
  private readonly pct = $('#ld-pct');
  private readonly log = $('#ld-log');
  private readonly meter = $('.ld-meter i');
  private shown = 0;
  private target = 0;
  private raf = 0;

  constructor() {
    const tick = () => {
      this.shown += (this.target - this.shown) * 0.12;
      if (Math.abs(this.target - this.shown) < 0.002) this.shown = this.target;
      if (this.pct) this.pct.textContent = String(Math.round(this.shown * 100)).padStart(3, '0');
      this.meter?.style.setProperty('--p', this.shown.toFixed(4));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  progress(p: number) {
    this.target = Math.max(this.target, Math.min(1, p));
  }

  line(text: string, ok = false) {
    if (!this.log) return null;
    const li = document.createElement('li');
    li.textContent = text;
    if (ok) li.className = 'ok';
    this.log.append(li);
    while (this.log.children.length > 9) this.log.firstElementChild?.remove();
    return li;
  }

  /** Resolve with the visitor's choice (or silently after `autoMs`). */
  ready(autoMs: number): Promise<'sound' | 'silent'> {
    this.progress(1);
    const actions = $('.ld-actions', this.root ?? document);
    if (!this.root || !actions) return Promise.resolve('silent');
    actions.hidden = false;
    gsap.from(actions.children, { y: 16, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' });
    const primary = actions.querySelector<HTMLButtonElement>('[data-enter="sound"]');
    primary?.focus({ preventScroll: true });
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve('silent'), autoMs);
      actions.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-enter]');
        if (!btn) return;
        window.clearTimeout(timer);
        resolve(btn.dataset.enter === 'sound' ? 'sound' : 'silent');
      });
    });
  }

  async leave() {
    if (!this.root) return;
    this.root.classList.add('is-leaving');
    await gsap
      .timeline()
      .to('.ld-core', { scale: 1.08, opacity: 0, filter: 'blur(10px)', duration: 0.7, ease: 'power3.in' })
      .to(this.root, { clipPath: 'inset(0 0 100% 0)', duration: 1.0, ease: 'expo.inOut' }, '-=0.25');
    cancelAnimationFrame(this.raf);
    this.root.remove();
  }

  remove() {
    cancelAnimationFrame(this.raf);
    this.root?.remove();
  }
}
