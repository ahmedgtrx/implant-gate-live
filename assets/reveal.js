const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const targets = [...document.querySelectorAll('[data-reveal]')];
  if (targets.length) {
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.08 });
    targets.forEach(target => observer.observe(target));
    reducedMotion.addEventListener?.('change', event => {
      if (event.matches) {
        observer.disconnect();
        document.documentElement.classList.remove('motion-ready');
        targets.forEach(target => target.classList.remove('is-visible'));
      }
    });
  }
}
