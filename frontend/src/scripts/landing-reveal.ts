/**
 * Reveal on scroll de la landing: IntersectionObserver que añade
 * `.is-visible` a los `[data-reveal]`. Sin dependencias, una sola
 * pasada por elemento. Respeta `prefers-reduced-motion` (muestra todo).
 */
export function initLandingReveal(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (els.length === 0) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const el of els) el.classList.add('is-visible');
    return;
  }

  if (!('IntersectionObserver' in window)) {
    for (const el of els) el.classList.add('is-visible');
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );

  for (const el of els) {
    el.classList.add('lp-reveal');
    io.observe(el);
  }
}
