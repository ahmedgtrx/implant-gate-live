// No default recipient: verification must be explicit at build time.
export function verifiedRecipient(recipient) {
  return recipient?.verified === true && typeof recipient.number === 'string' && /^[1-9][0-9]{7,14}$/.test(recipient.number) ? recipient.number : null;
}
const validText = (value, max, multiline = false) => typeof value === 'string' && value.length <= max && !(multiline ? /[<>\u0000-\u0008\u000b-\u001f\u007f]/ : /[<>\u0000-\u001f\u007f]/).test(value);
export function buildWhatsAppUrl({ intent = 'patient', name = '', message = '', courseSlug, branchId, lang = 'ar' } = {}, config = {}) {
  if (!['patient', 'course', 'international'].includes(intent) || !['ar', 'en'].includes(lang) || !validText(name, 80) || !validText(message, 1000, true)) return null;
  if (courseSlug !== undefined && (typeof courseSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug) || !config.courseSlugs?.includes(courseSlug))) return null;
  let branch;
  let recipient;
  if (branchId !== undefined) {
    if (intent !== 'patient' || typeof branchId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchId)) return null;
    const matches = Array.isArray(config.branches) ? config.branches.filter(item => item?.id === branchId) : [];
    if (matches.length !== 1) return null;
    branch = matches[0];
    recipient = verifiedRecipient(branch);
  } else {
    recipient = verifiedRecipient(config[intent === 'course' ? 'academy' : 'clinic']);
  }
  if (!recipient) return null;
  const labels = lang === 'en'
    ? { patient: 'Appointment request', course: 'Course enquiry', international: 'International patient enquiry', branch: 'Branch', name: 'Name', message: 'Message' }
    : { patient: 'طلب موعد', course: 'استفسار عن دورة', international: 'استفسار مريض من الخارج', branch: 'الفرع', name: 'الاسم', message: 'الرسالة' };
  const lines = [labels[intent]];
  if (intent === 'course' && courseSlug) lines.push(courseSlug);
  if (branch?.name?.[lang]) lines.push(labels.branch + ': ' + branch.name[lang]);
  if (name.trim()) lines.push(labels.name + ': ' + name.trim());
  if (message.trim()) lines.push(labels.message + ': ' + message.trim());
  const url = new URL('https://wa.me/' + recipient);
  url.searchParams.set('text', lines.join('\n'));
  return url.href;
}
export function openWhatsAppDraft(url, fallback, openWindow) {
  if (!url || !fallback) return false;
  fallback.href = url;
  fallback.hidden = false;
  let opened = false;
  try { opened = Boolean(openWindow(url, '_blank', 'noopener,noreferrer')); } catch { /* Ordinary link remains usable. */ }
  if (!opened) fallback.focus();
  return opened;
}
export function initContact(root, config, search = '') {
  const form = root.querySelector('[data-contact-form]');
  if (!form) return;
  const lang = root.documentElement.lang;
  const params = new URLSearchParams(search);
  const status = root.querySelector('[data-contact-status]');
  const requestedIntents = params.getAll('intent');
  const requestedIntent = requestedIntents.length === 1 ? requestedIntents[0] : null;
  if (requestedIntents.length && (requestedIntents.length !== 1
    || !['patient', 'course', 'international'].includes(requestedIntent)
    || (requestedIntent === 'course' ? !config.academy : !config.clinic))) {
    status.textContent = form.dataset.unavailable;
    return;
  }
  const intentField = form.elements.namedItem('intent');
  const courseField = form.elements.namedItem('courseSlug');
  if (requestedIntent) {
    const option = [...intentField.options].find(option => option.value === requestedIntent);
    if (option) intentField.value = requestedIntent;
    else {
      status.textContent = form.dataset.unavailable;
      return;
    }
  }
  if (requestedIntent === 'course' && params.getAll('course').length === 1 && config.courseSlugs.includes(params.get('course'))) courseField.value = params.get('course');
  const fallback = root.querySelector('[data-contact-fallback]');
  const values = () => ({ intent: intentField.value, courseSlug: intentField.value === 'course' && courseField.value ? courseField.value : undefined, name: form.elements.namedItem('name').value, message: form.elements.namedItem('message').value, lang });
  const update = () => {
    courseField.closest('label').hidden = intentField.value !== 'course';
    // Reveal the generic link only after resolving the selected team's destination.
    const url = buildWhatsAppUrl(values(), config) || buildWhatsAppUrl({ intent: intentField.value, lang }, config);
    fallback.hidden = !url;
    if (url) {
      fallback.href = url;
      fallback.dataset.team = intentField.value === 'course' ? 'academy' : 'clinic';
    } else {
      fallback.removeAttribute('href');
      delete fallback.dataset.team;
    }
  };
  form.hidden = false;
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = buildWhatsAppUrl(values(), config);
    if (!url) { status.textContent = status.dataset.invalid; return; }
    status.textContent = status.dataset.draft;
    openWhatsAppDraft(url, fallback, window.open.bind(window));
  });
  update();
}
if (typeof document !== 'undefined') {
  const data = document.querySelector('[data-contact-config]');
  if (data) initContact(document, JSON.parse(data.textContent), window.location.search);
}
