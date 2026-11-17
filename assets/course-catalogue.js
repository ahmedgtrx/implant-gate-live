export function matchesCourse(card, filters) {
  return Object.entries(filters).every(([field, value]) => !value || card[field] === value);
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-course-catalogue]').forEach(catalogue => {
  const controls = catalogue.querySelector('[data-course-controls]');
  if (!controls) return;
  const inputs = [...controls.querySelectorAll('[data-course-filter]')];
  const cards = [...catalogue.querySelectorAll('[data-course-card]')];
  const update = () => {
    const filters = Object.fromEntries(inputs.map(input => [input.dataset.courseFilter, input.value]));
    cards.forEach(card => { card.hidden = !matchesCourse(card.dataset, filters); });
    catalogue.querySelector('[data-course-no-match]').hidden = cards.some(card => !card.hidden);
  };
  controls.hidden = false;
  inputs.forEach(input => input.addEventListener('change', update));
  update();
});
