import { gsap } from 'gsap';
import { $ } from './dom';

/** A dot that tracks exactly and a ring that lags, growing over anything clickable. */
export function initCursor() {
  const root = $('.cursor');
  if (!root || matchMedia('(pointer: coarse)').matches) return;
  document.documentElement.classList.add('custom-cursor');
  const dot = $('.cursor-dot', root)!;
  const ring = $('.cursor-ring', root)!;
  const label = $('.cursor-label', root)!;
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    dx(e.clientX);
    dy(e.clientY);
    rx(e.clientX);
    ry(e.clientY);
  });
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('a, button, [data-cursor], input, textarea, .proj');
    root.classList.toggle('is-hover', !!t);
    label.textContent = t?.dataset.cursor ?? (t?.tagName === 'A' ? 'OPEN' : '');
  });
  document.addEventListener('pointerleave', () => gsap.to(root, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to(root, { opacity: 1, duration: 0.2 }));
}
