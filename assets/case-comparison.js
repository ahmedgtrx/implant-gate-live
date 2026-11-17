// Native range input provides Arrow, Home/End and touch controls; both captions remain readable.
for (const comparison of document.querySelectorAll('[data-comparison]')) {
  const slider = comparison.querySelector('[data-comparison-slider]');
  const update = () => {
    const value = Math.min(100, Math.max(0, Number(slider.value)));
    comparison.style.setProperty('--comparison-position', value + '%');
    slider.setAttribute('aria-valuetext', slider.dataset.valueTemplate.replace('{value}', String(value)));
  };
  slider.addEventListener('input', update);
  comparison.querySelector('[data-comparison-control]').hidden = false;
  comparison.classList.add('enhanced');
  update();
}
for (const gallery of document.querySelectorAll('[data-gallery]')) {
  const filter = gallery.querySelector('[data-case-filter]');
  if (!filter) continue;
  gallery.querySelector('[data-gallery-controls]').hidden = false;
  filter.addEventListener('change', () => {
    let visible = 0;
    for (const card of gallery.querySelectorAll('[data-case-card]')) {
      card.hidden = Boolean(filter.value && card.dataset.treatment !== filter.value);
      if (!card.hidden) visible++;
    }
    gallery.querySelector('[data-gallery-no-match]').hidden = visible !== 0;
  });
}
