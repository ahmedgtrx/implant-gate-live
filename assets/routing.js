// Campaign values are an explicit public vocabulary, never free-form input.
const campaigns = {
  utm_source: ['qr', 'google', 'instagram', 'facebook', 'website'],
  utm_medium: ['qr', 'QR', 'social', 'organic', 'print', 'referral'],
  utm_campaign: ['autumn', 'general', 'patients', 'academy'],
  utm_content: ['general', 'patients', 'academy'],
};
export function safeAttribution(search = '') {
  const input = new URLSearchParams(search);
  const output = new URLSearchParams();
  for (const [key, values] of Object.entries(campaigns)) {
    const entries = input.getAll(key);
    if (entries.length === 1 && values.includes(entries[0])) output.set(key, entries[0]);
  }
  return output.size ? '?' + output.toString() : '';
}
export function localPath(lang, route = '') {
  const locale = lang === 'en' ? 'en' : 'ar';
  if (typeof route !== 'string' || !/^\/?(?:[a-z0-9-]+\/)*[a-z0-9-]*\/?$/.test(route) || route.includes('..')) return `/${locale}/`;
  const segments = route.split('/').filter(Boolean);
  if (['ar', 'en'].includes(segments[0])) segments.shift();
  return `/${locale}/` + (segments.length ? segments.join('/') + '/' : '');
}
export function localizedUrl(lang, route, search = '', hash = '', courseSlugs = []) {
  const path = localPath(lang, route);
  const query = new URLSearchParams(safeAttribution(search));
  const input = new URLSearchParams(search);
  const course = input.get('course');
  if (/^\/(ar|en)\/contact\/$/.test(path) && input.getAll('intent').length === 1 && input.get('intent') === 'course' && input.getAll('course').length === 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(course) && courseSlugs.includes(course)) { query.set('intent', 'course'); query.set('course', course); }
  return path + (query.size ? '?' + query.toString() : '') + (/^#[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(hash) ? hash : '');
}
export function legacyDestination(hash, search = '') {
  const sections = { pathways: 'overview', care: 'overview', services: 'treatments', team: 'team', cases: 'cases', stories: 'reviews', international: 'international', locations: 'locations', contact: 'contact', 'contact-form': 'contact' };
  if (hash === '#main') return '/ar/' + safeAttribution(search) + '#main';
  if (hash === '#academy') return '/ar/academy/' + safeAttribution(search);
  return Object.hasOwn(sections, hash.slice(1)) ? '/ar/patients/' + safeAttribution(search) + '#' + sections[hash.slice(1)] : '/ar/' + safeAttribution(search);
}
