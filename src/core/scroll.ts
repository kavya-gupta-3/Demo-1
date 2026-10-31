import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { clamp, smoothstep } from './math';

interface SectionMetric {
  el: HTMLElement;
  top: number;
  height: number;
}

/**
 * Smooth scrolling (Lenis) plus the two numbers the 3D world is driven by:
 *  - `stage`: a continuous 0‥6 coordinate. It only moves near section
 *    boundaries, so the camera flies between dragons exactly while one
 *    section hands over to the next.
 *  - `local[i]`: how far the reader is through section i (0‥1).
 */
export class Scroll {
  readonly lenis: Lenis | null;
  y = 0;
  velocity = 0;
  vh = window.innerHeight;
  max = 1;
  stage = 0;
  active = 0;
  local: number[] = [];
  private sections: SectionMetric[] = [];
  private lastY = 0;

  constructor(smooth: boolean) {
    this.lenis = smooth
      ? new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false, autoRaf: false })
      : null;
    this.lenis?.on('scroll', ScrollTrigger.update);
    ScrollTrigger.addEventListener('refresh', () => this.measure());
    window.addEventListener('resize', () => this.measure());
  }

  attach(elements: HTMLElement[]) {
    this.sections = elements.map((el) => ({ el, top: 0, height: 1 }));
    this.local = elements.map(() => 0);
    this.measure();
  }

  measure() {
    this.vh = window.innerHeight;
    const sy = window.scrollY;
    for (const s of this.sections) {
      const r = s.el.getBoundingClientRect();
      s.top = r.top + sy;
      s.height = Math.max(1, r.height);
    }
    this.max = Math.max(1, document.documentElement.scrollHeight - this.vh);
  }

  raf(timeMs: number) {
    this.lenis?.raf(timeMs);
  }

  update(dt: number) {
    const y = this.lenis ? this.lenis.animatedScroll : window.scrollY;
    this.velocity = this.lenis ? this.lenis.velocity : (y - this.lastY) / Math.max(dt * 60, 1e-3);
    this.lastY = y;
    this.y = y;
    const center = y + this.vh * 0.5;
    let stage = 0;
    for (let k = 1; k < this.sections.length; k++) {
      const boundary = this.sections[k].top;
      stage += smoothstep(boundary - this.vh * 0.6, boundary + this.vh * 0.3, center);
    }
    this.stage = stage;
    this.active = clamp(Math.round(stage), 0, this.sections.length - 1);
    for (let i = 0; i < this.sections.length; i++) {
      const s = this.sections[i];
      this.local[i] = clamp((y - s.top) / Math.max(1, s.height - this.vh));
    }
  }

  get progress() {
    return clamp(this.y / this.max);
  }

  sectionTop(index: number) {
    return this.sections[index]?.top ?? 0;
  }

  to(target: number | HTMLElement, immediate = false) {
    if (this.lenis) {
      this.lenis.scrollTo(target, { immediate, duration: immediate ? 0 : 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else {
      const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' });
    }
  }

  stop() {
    this.lenis?.stop();
    document.documentElement.classList.add('scroll-locked');
  }

  start() {
    this.lenis?.start();
    document.documentElement.classList.remove('scroll-locked');
  }
}
