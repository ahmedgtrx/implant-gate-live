const carousel = document.querySelector('[data-academy-carousel]');

if (carousel) {
  const viewport = carousel.querySelector('[data-carousel-viewport]');
  const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
  const controls = carousel.querySelector('[data-carousel-controls]');
  const previous = carousel.querySelector('[data-carousel-previous]');
  const next = carousel.querySelector('[data-carousel-next]');
  const toggle = carousel.querySelector('[data-carousel-toggle]');
  const toggleIcon = carousel.querySelector('[data-carousel-toggle-icon]');
  const position = carousel.querySelector('[data-carousel-position]');
  const status = carousel.querySelector('[data-carousel-status]');

  if (viewport && slides.length > 1 && controls && previous && next && toggle) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const interval = Math.min(12000, Math.max(5000, Number(carousel.dataset.interval) || 7000));
    const initial = slides.findIndex(slide => slide.classList.contains('is-active'));
    let activeIndex = initial >= 0 ? initial : 0;
    let rotationEnabled = !reducedMotion.matches;
    let rotationTimer;
    let carouselInView = false;
    let hoverPaused = false;
    let touchStart = null;
    let ignoreClickUntil = 0;
    let togglePointerId = null;

    const clearRotationTimer = () => {
      window.clearTimeout(rotationTimer);
      rotationTimer = undefined;
    };

    const scheduleRotation = () => {
      clearRotationTimer();
      if (!rotationEnabled || reducedMotion.matches || document.hidden || !carouselInView || hoverPaused) return;
      rotationTimer = window.setTimeout(() => {
        setActiveSlide(activeIndex + 1, false);
        scheduleRotation();
      }, interval);
    };

    const updateRotationControl = () => {
      toggle.setAttribute('aria-pressed', String(rotationEnabled));
      if (toggleIcon) toggleIcon.textContent = rotationEnabled ? 'Ⅱ' : '▶';
      toggle.disabled = reducedMotion.matches;
    };

    function setActiveSlide(index, manual = true) {
      activeIndex = (index + slides.length) % slides.length;
      for (const [slideIndex, slide] of slides.entries()) {
        const active = slideIndex === activeIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
        slide.inert = !active;
      }
      if (position) position.textContent = `${activeIndex + 1} / ${slides.length}`;
      if (manual && status?.dataset.statusTemplate) {
        const number = new Intl.NumberFormat(document.documentElement.lang || 'en');
        status.textContent = status.dataset.statusTemplate
          .replace('{current}', number.format(activeIndex + 1))
          .replace('{total}', number.format(slides.length));
      }
      scheduleRotation();
    }

    const stopForFocus = event => {
      if (togglePointerId !== null && toggle.contains(event.target)) return;
      if (!rotationEnabled) return;
      rotationEnabled = false;
      hoverPaused = false;
      updateRotationControl();
      scheduleRotation();
    };

    carousel.classList.add('is-ready');
    controls.hidden = false;
    updateRotationControl();
    setActiveSlide(activeIndex, false);

    previous.addEventListener('click', () => setActiveSlide(activeIndex - 1));
    next.addEventListener('click', () => setActiveSlide(activeIndex + 1));
    toggle.addEventListener('click', () => {
      if (reducedMotion.matches) return;
      rotationEnabled = !rotationEnabled;
      updateRotationControl();
      scheduleRotation();
    });

    carousel.addEventListener('focusin', stopForFocus);
    carousel.addEventListener('pointerdown', event => {
      if (toggle.contains(event.target)) togglePointerId = event.pointerId;
    }, true);
    window.addEventListener('pointerup', event => {
      if (event.pointerId !== togglePointerId) return;
      window.setTimeout(() => { togglePointerId = null; }, 0);
    }, true);
    window.addEventListener('pointercancel', event => {
      if (event.pointerId === togglePointerId) togglePointerId = null;
    }, true);
    carousel.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !rotationEnabled) return;
      hoverPaused = true;
      scheduleRotation();
    });
    carousel.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse' || !hoverPaused) return;
      hoverPaused = false;
      scheduleRotation();
    });

    viewport.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const rtl = getComputedStyle(viewport).direction === 'rtl';
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveSlide(activeIndex + (rtl ? -1 : 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveSlide(activeIndex + (rtl ? 1 : -1));
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveSlide(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveSlide(slides.length - 1);
      }
    });

    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    viewport.addEventListener('pointerup', event => {
      if (event.pointerType !== 'touch' || !touchStart || event.pointerId !== touchStart.id) return;
      const deltaX = event.clientX - touchStart.x;
      const deltaY = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
      ignoreClickUntil = performance.now() + 450;
      setActiveSlide(activeIndex + (deltaX < 0 ? 1 : -1));
    });
    viewport.addEventListener('pointercancel', () => { touchStart = null; });
    viewport.addEventListener('click', event => {
      if (performance.now() >= ignoreClickUntil || !event.target.closest('a')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener('visibilitychange', scheduleRotation);
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) rotationEnabled = false;
      updateRotationControl();
      scheduleRotation();
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        carouselInView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.25);
        scheduleRotation();
      }, { threshold: [0, 0.25] });
      observer.observe(carousel);
    } else {
      carouselInView = true;
      scheduleRotation();
    }
  }
}
