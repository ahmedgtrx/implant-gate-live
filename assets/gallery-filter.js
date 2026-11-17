const controls = document.querySelector('[data-gallery-filters]');
const gallery = document.querySelector('[data-unified-gallery]');

if (controls && gallery) {
  controls.hidden = false;
  const buttons = [...controls.querySelectorAll('[data-gallery-filter]')];
  const items = [...gallery.querySelectorAll('[data-gallery-item]')];
  const groups = [...gallery.querySelectorAll('[data-gallery-group]')];
  const count = gallery.querySelector('[data-gallery-count]');
  const validCategories = new Set(items.map(item => item.dataset.category));

  const applyFilter = (requested, updateUrl = false) => {
    const active = requested === 'all' || validCategories.has(requested) ? requested : 'all';
    let visible = 0;
    for (const item of items) {
      const show = active === 'all' || item.dataset.category === active;
      item.hidden = !show;
      if (show) visible++;
    }
    for (const group of groups) {
      group.hidden = active !== 'all' && group.dataset.galleryGroup !== active;
    }
    for (const button of buttons) {
      const selected = button.dataset.galleryFilter === active;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
    if (count) count.textContent = (count.dataset.resultTemplate || '{count}').replace('{count}', String(visible));
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (active === 'all') url.searchParams.delete('category');
      else url.searchParams.set('category', active);
      window.history.replaceState(null, '', url);
    }
  };

  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-filter]');
    if (button && controls.contains(button)) applyFilter(button.dataset.galleryFilter, true);
  });

  applyFilter(new URLSearchParams(window.location.search).get('category') || 'all');
}
