import { localizedUrl, safeAttribution, legacyDestination } from './routing.js';

// The no-JavaScript navigation stays visible until this module is available.
document.documentElement?.classList?.replace?.('no-js', 'has-js');

const floatingContact = document.querySelector('[data-floating-contact]');
if (floatingContact) {
  const mediaCards = [...document.querySelectorAll('.site-image-card, .review-comparison-card, .case-comparison, .d2-hero-figure, .d2-entry-card, .d2-gallery-item, .d2-activity-photo, .d2-academy-carousel, .d2-academy-copy, .d2-contact, .d2-footer')];
  floatingContact.hidden = false;
  let updateScheduled = false;
  const updateFloatingContact = () => {
    updateScheduled = false;
    const button = floatingContact.getBoundingClientRect();
    const overlapsMedia = mediaCards.some((card) => {
      const media = card.getBoundingClientRect();
      return media.width > 0 && media.height > 0
        && media.right > button.left && media.left < button.right
        && media.bottom > button.top && media.top < button.bottom;
    });
    floatingContact.toggleAttribute('data-obscured-by-media', overlapsMedia);
  };
  const scheduleContactUpdate = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    window.requestAnimationFrame(updateFloatingContact);
  };
  updateFloatingContact();
  window.addEventListener('scroll', scheduleContactUpdate, { passive: true });
  window.addEventListener('resize', scheduleContactUpdate);
}

const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('#primary-nav');
const moreMenus = [...document.querySelectorAll('#primary-nav details[data-nav-more]')];
const closeMore = (menu, restoreFocus = false) => {
  if (!menu.open) return;
  menu.open = false;
  if (restoreFocus) menu.querySelector('summary')?.focus();
};

for (const menu of moreMenus) {
  menu.addEventListener('click', (event) => {
    if (event.target.closest?.('a')) closeMore(menu);
  });
  menu.addEventListener('focusout', (event) => {
    if (!menu.contains(event.relatedTarget)) closeMore(menu);
  });
}

document.addEventListener('pointerdown', (event) => {
  for (const menu of moreMenus) {
    if (menu.open && !menu.contains(event.target)) closeMore(menu);
  }
});

if (toggle && nav) {
  const compact = window.matchMedia(document.body.classList.contains('d2-page') ? '(max-width: 1100px)' : '(max-width: 767px)');
  let open = false;
  const update = () => {
    toggle.hidden = !compact.matches;
    nav.hidden = compact.matches && !open;
    toggle.setAttribute('aria-expanded', String(compact.matches && open));
  };
  toggle.addEventListener('click', () => {
    open = !open;
    if (!open) moreMenus.forEach((menu) => { menu.open = false; });
    update();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openMore = moreMenus.find((menu) => menu.open);
    if (openMore) {
      event.preventDefault();
      closeMore(openMore, true);
      return;
    }
    if (open) {
      event.preventDefault();
      open = false;
      update();
      toggle.focus();
    }
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest?.('a')) {
      moreMenus.forEach((menu) => { menu.open = false; });
      open = false;
      update();
    }
  });
  compact.addEventListener('change', () => {
    open = false;
    moreMenus.forEach((menu) => { menu.open = false; });
    update();
  });
  update();
}
const { search, hash } = window.location;
const pathname = window.location.pathname.replace(/^\/implant-gate-live(?=\/|$)/, '') || '/';
const bridge = document.querySelector('[data-legacy-bridge]');
if (bridge) {
  let destination = legacyDestination(hash, search);
  try {
    if (!hash && localStorage.getItem('implant-gate-language') === 'en') destination = '/en/' + safeAttribution(search);
  } catch { /* Language links remain usable if storage is unavailable. */ }
  window.location.replace('/implant-gate-live' + destination);
} else {
  const lang = pathname.split('/')[1] === 'en' ? 'en' : 'ar';
  try { localStorage.setItem('implant-gate-language', lang); } catch { /* Optional preference only. */ }
  const courseContext = document.querySelector('[data-public-courses]');
  const courseSlugs = courseContext ? JSON.parse(courseContext.textContent) : [];
  const updateLocaleLinks = () => document.querySelectorAll('[data-locale]').forEach((link) => {
    link.href = '/implant-gate-live' + localizedUrl(link.dataset.locale, pathname, search, window.location.hash, courseSlugs);
  });
  updateLocaleLinks();
  window.addEventListener('hashchange', updateLocaleLinks);
  document.querySelectorAll('a[data-internal]').forEach((link) => {
    const destination = new URL(link.href);
    link.href = destination.pathname + safeAttribution(search) + destination.hash;
  });
}
