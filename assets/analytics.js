import { safeAttribution } from './routing.js';

// Approved, non-sensitive vocabulary only: no free text, names, messages or medical details.
const actions = new Set(['pageview', 'clinic-whatsapp', 'academy-whatsapp', 'course-enquiry', 'locale-switch']);
const audiences = new Set(['home', 'patients', 'academy', 'contact', 'team', 'locations', 'international']);

const endpoint = config => {
  const value = config?.analytics;
  if (value?.enabled !== true || value?.consentPolicy !== true) return null;
  try {
    const url = new URL(value.endpoint);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
};

/** Build a privacy-safe analytics recorder; inert unless explicitly enabled with a consent policy. */
export function createAnalytics(config, { send, search = '', route = '' } = {}) {
  const url = endpoint(config);
  const noop = { pageview() {}, event() {}, enabled: false };
  if (!url || typeof send !== 'function') return noop;
  const audience = audiences.has(route.split('/')[0]) ? route.split('/')[0] : 'home';
  const campaign = safeAttribution(search).slice(1);
  const record = action => {
    if (!actions.has(action)) return;
    send({ action, audience, campaign });
  };
  return { enabled: true, pageview: () => record('pageview'), event: record };
}

if (typeof document !== 'undefined') {
  const data = document.querySelector('[data-analytics-config]');
  const config = data ? JSON.parse(data.textContent) : null;
  const send = payload => {
    const url = endpoint(config);
    if (navigator.sendBeacon?.(url, JSON.stringify(payload))) return;
    fetch(url, { method: 'POST', body: JSON.stringify(payload), keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  };
  const tracker = createAnalytics(config, { send, search: window.location.search, route: document.body?.dataset.route || '' });
  if (tracker.enabled) {
    tracker.pageview();
    document.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      if (link.hasAttribute('data-course-enquiry')) tracker.event('course-enquiry');
      else if (link.dataset.team === 'academy') tracker.event('academy-whatsapp');
      else if (link.dataset.team === 'clinic') tracker.event('clinic-whatsapp');
      else if (link.hasAttribute('data-locale')) tracker.event('locale-switch');
    });
  }
}
