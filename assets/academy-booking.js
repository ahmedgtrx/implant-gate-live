import { verifiedRecipient } from './contact.js';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const westernDigits = value => String(value ?? '').replace(/[٠-٩۰-۹]/g, digit => {
  const index = arabicDigits.indexOf(digit);
  return String(index < 0 ? persianDigits.indexOf(digit) : index);
});
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !/[<>\u0000-\u001f\u007f]/.test(value);
const validPreferredDate = value => {
  if (value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

function courseOption(input, course, { enquiryOnly = false } = {}) {
  return course?.bookingOptions?.find(option => option.id === input?.optionId
    && (enquiryOnly
      ? option.enquiryEnabled === true && option.bookingEnabled !== true
      : option.bookingEnabled === true)) || null;
}
function selectedSession(input, option) {
  return option?.schedulingMode === 'sessions'
    ? option.sessions?.find(session => session.id === input?.sessionId) || null
    : null;
}
function safeLocale(lang) { return lang === 'ar' ? 'ar-EG' : 'en-GB'; }
export function formatMoney(amount, currency, lang = 'en') {
  if (!Number.isSafeInteger(amount) || amount < 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return '';
  try { return new Intl.NumberFormat(safeLocale(lang), { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${amount} ${currency}`; }
}
export function formatSessionWindow(session, lang = 'en') {
  if (!session || !Number.isFinite(Date.parse(session.startsAt)) || !Number.isFinite(Date.parse(session.endsAt))) return '';
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat(safeLocale(lang), { dateStyle: 'long', timeStyle: 'short', timeZone: session.timeZone });
    formatter.format(new Date(session.startsAt));
  } catch { return ''; }
  const start = formatter.format(new Date(session.startsAt));
  const end = new Intl.DateTimeFormat(safeLocale(lang), { timeStyle: 'short', timeZone: session.timeZone }).format(new Date(session.endsAt));
  return `${start} – ${end} (${session.timeZone})`;
}
function formatPreferredDate(value, lang) {
  if (!validPreferredDate(value) || !value) return '';
  return new Intl.DateTimeFormat(safeLocale(lang), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
function typeLabel(type, lang) {
  return lang === 'ar' ? (type === 'group' ? 'مجموعة' : 'فردي خاص') : (type === 'group' ? 'Group' : 'One-to-One Private');
}

export function validateBookingStage(input = {}, course, stage, { enquiryOnly = false } = {}) {
  const errors = {};
  const option = courseOption(input, course, { enquiryOnly });
  let session = null;
  if (stage === 1) {
    if (!option) errors.optionId = 'optionId';
  } else if (stage === 2) {
    if (!option) errors.optionId = 'optionId';
    if (enquiryOnly) {
      if (input.sessionId) errors.sessionId = 'sessionId';
      if (!validPreferredDate(input.preferredDate)) errors.preferredDate = 'preferredDate';
      const groupSize = westernDigits(input.groupSize).trim();
      if (option?.type === 'group' && groupSize
        && (!/^\d+$/.test(groupSize) || Number(groupSize) < 1 || Number(groupSize) > option.maximumGroupSize)) {
        errors.groupSize = 'groupSize';
      } else if (option?.type !== 'group' && groupSize) errors.groupSize = 'groupSize';
    } else if (option?.schedulingMode === 'sessions') {
      session = selectedSession(input, option);
      if (!session || session.availableSeats === 0) errors.sessionId = 'sessionId';
    } else if (option?.schedulingMode === 'request' && input.sessionId) errors.sessionId = 'sessionId';
    if (option?.type === 'private' && option.schedulingMode === 'request' && !validPreferredDate(input.preferredDate)) errors.preferredDate = 'preferredDate';
  } else if (stage === 3) {
    if (!validText(input.name, 80)) errors.name = 'name';
    const phone = westernDigits(input.phone).trim();
    const digits = phone.replace(/\D/g, '');
    if (!/^[+()\d\s-]+$/.test(phone) || digits.length < 7 || digits.length > 20) errors.phone = 'phone';
  } else errors.stage = 'stage';
  return { valid: Object.keys(errors).length === 0, errors, option, session };
}

export function validateBooking(input = {}, course, options = {}) {
  const results = [1, 2, 3].map(stage => validateBookingStage(input, course, stage, options));
  const errors = Object.assign({}, ...results.map(result => result.errors));
  const option = results[0].option;
  const session = results[1].session;
  return { valid: Object.keys(errors).length === 0, errors, option, session };
}

const safePaymentText = (value, max, multiline = false) => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !(multiline ? /[<>\u0000-\u0008\u000b-\u001f\u007f]/ : /[<>\u0000-\u001f\u007f]/).test(value);

/** Return selected payment details only for a fully verified option and approved real or explicitly local demo data. */
export function paymentInstructionsForBooking(input = {}, course, payment, lang = 'en') {
  if (!['ar', 'en'].includes(lang) || !payment) return null;
  const validation = validateBooking(input, course);
  const option = validation.option;
  if (!validation.valid || !option?.bookingEnabled || !option.paymentPolicy
    || !safePaymentText(option.paymentPolicy.ar, 1000, true) || !safePaymentText(option.paymentPolicy.en, 1000, true)
    || !Number.isSafeInteger(option.fee?.amount) || option.fee.amount <= 0
    || !Number.isSafeInteger(option.deposit?.amount) || option.deposit.amount <= 0
    || option.fee.currency !== option.deposit.currency || option.deposit.amount > option.fee.amount) return null;

  const localDemo = course?.localDemo === true && payment.localDemo === true;
  if (!localDemo && (payment.recipientVerified !== true || payment.instructionsVerified !== true || payment.publicDisplayApproved !== true)) return null;
  if (!safePaymentText(payment.displayName?.ar, 100) || !safePaymentText(payment.displayName?.en, 100)
    || !safePaymentText(payment.identifier, 120)
    || !safePaymentText(payment.depositInstructions?.ar, 1000, true)
    || !safePaymentText(payment.depositInstructions?.en, 1000, true)) return null;

  return {
    localDemo,
    displayName: payment.displayName[lang].trim(),
    identifier: payment.identifier.trim(),
    depositInstructions: payment.depositInstructions[lang].trim(),
    paymentPolicy: option.paymentPolicy[lang].trim(),
  };
}

export function summarizeBooking(input = {}, course, lang = 'en', { enquiryOnly = false } = {}) {
  const validation = validateBooking(input, course, { enquiryOnly });
  const { option, session } = validation;
  const preferredDate = (enquiryOnly || option?.type === 'private' && option.schedulingMode === 'request')
    ? formatPreferredDate(input.preferredDate, lang)
    : '';
  const total = option?.fee?.amount;
  const deposit = option?.deposit?.amount;
  return {
    valid: validation.valid,
    errors: validation.errors,
    courseTitle: course?.title?.[lang] || '',
    trainingType: option ? typeLabel(option.type, lang) : '',
    sessionLabel: enquiryOnly
      ? (lang === 'ar' ? 'لم يتم تأكيد موعد محدد' : 'No fixed session is confirmed')
      : option?.schedulingMode === 'request'
      ? (lang === 'ar' ? 'حسب الطلب' : 'By request')
      : formatSessionWindow(session, lang),
    preferredDate,
    name: typeof input.name === 'string' ? input.name.trim() : '',
    phone: westernDigits(input.phone).trim(),
    total,
    deposit,
    balance: Number.isSafeInteger(total) && Number.isSafeInteger(deposit) ? total - deposit : undefined,
    currency: option?.fee?.currency,
    totalLabel: Number.isSafeInteger(total) ? formatMoney(total, option.fee.currency, lang) : '',
    depositLabel: Number.isSafeInteger(deposit) ? formatMoney(deposit, option.deposit.currency, lang) : '',
    balanceLabel: Number.isSafeInteger(total) && Number.isSafeInteger(deposit) ? formatMoney(total - deposit, option.fee.currency, lang) : '',
    groupSize: option?.type === 'group' && /^\d+$/.test(westernDigits(input.groupSize).trim()) ? Number(westernDigits(input.groupSize).trim()) : undefined,
    feeUnit: option?.feeUnit,
    depositUnit: option?.depositUnit,
    maximumGroupSize: option?.maximumGroupSize,
    practicalCases: option?.practicalCases,
    optionType: option?.type,
  };
}

export function formatBookingMessage(input = {}, course, lang = 'en', { paymentInstructionsAvailable = false, enquiryOnly = false } = {}) {
  if (!['ar', 'en'].includes(lang)) return null;
  const summary = summarizeBooking(input, course, lang, { enquiryOnly });
  if (!summary.valid) return null;
  if (enquiryOnly) {
    const option = courseOption(input, course, { enquiryOnly });
    if (!option || !summary.totalLabel || !summary.depositLabel || !option.practicalCases) return null;
    if (lang === 'en') {
      const participants = option.type === 'group'
        ? `Requested group size: ${summary.groupSize ? `${summary.groupSize} doctors` : 'not specified'}; group maximum: ${option.maximumGroupSize} doctors. This request does not indicate current availability.`
        : 'Participants: one doctor.';
      const priceScope = option.type === 'group'
        ? `total for the entire group of up to ${option.maximumGroupSize} doctors`
        : 'for one doctor';
      const caseScope = option.type === 'group' ? 'one practical Implant case for the group' : 'one practical Implant case for one doctor';
      const schedule = summary.preferredDate
        ? `Preferred date requested: ${summary.preferredDate}. This is a preference, not a confirmed session.`
        : 'Please share current scheduling options; no fixed session or time is confirmed.';
      return [
        'Implant Gate Academy enquiry — not a booking or reservation',
        `Course: ${summary.courseTitle}`,
        `Training format: ${summary.trainingType}`,
        participants,
        `Total fee: ${summary.totalLabel} — ${priceScope}`,
        `Deposit: ${summary.depositLabel} per course booking; non-refundable after formal confirmation`,
        `Practical case: ${caseScope}`,
        schedule,
        `Name: ${summary.name}`,
        `Phone/WhatsApp: ${summary.phone}`,
        'Please confirm current availability and next steps before any transfer.',
        'Any payment is handled manually outside this website through InstaPay. If staff requests a transfer after confirmation, I will attach proof manually in WhatsApp.',
        'This enquiry does not reserve a place or confirm payment.',
      ].join('\n');
    }
    const participants = option.type === 'group'
      ? `عدد الأطباء المطلوب: ${summary.groupSize || 'غير محدد'}؛ الحد الأقصى للمجموعة ${option.maximumGroupSize} أطباء. هذا الطلب لا يعبّر عن التوفر الحالي.`
      : 'عدد المشاركين: طبيب واحد.';
    const priceScope = option.type === 'group'
      ? `إجمالي المجموعة كاملة بحد أقصى ${option.maximumGroupSize} أطباء`
      : 'لطبيب واحد';
    const caseScope = option.type === 'group' ? 'حالة زراعة عملية واحدة للمجموعة' : 'حالة زراعة عملية واحدة لطبيب واحد';
    const schedule = summary.preferredDate
      ? `التاريخ المفضل المطلوب: ${summary.preferredDate}. هذا تفضيل وليس موعداً مؤكداً.`
      : 'يرجى إرسال خيارات المواعيد الحالية؛ لم يُؤكد موعد أو وقت محدد.';
    return [
      'استفسار لأكاديمية Implant Gate — ليس حجزاً أو تأكيداً',
      `الدورة: ${summary.courseTitle}`,
      `نوع التدريب: ${summary.trainingType}`,
      participants,
      `إجمالي الرسوم: ${summary.totalLabel} — ${priceScope}`,
      `العربون: ${summary.depositLabel} لكل حجز دورة؛ غير قابل للاسترداد بعد التأكيد الرسمي`,
      `الحالة العملية: ${caseScope}`,
      schedule,
      `الاسم: ${summary.name}`,
      `رقم الهاتف/واتساب: ${summary.phone}`,
      'يرجى تأكيد التوفر والخطوات التالية قبل أي تحويل.',
      'يُجرى أي دفع يدوياً عبر InstaPay خارج هذا الموقع. وإذا طلب الفريق التحويل بعد التأكيد، سأرفق الإثبات يدوياً في واتساب.',
      'هذا الاستفسار لا يحجز مقعداً ولا يؤكد الدفع.',
    ].join('\n');
  }
  if (lang === 'en') return [
    'Booking request — enquiry only, not a confirmed reservation',
    `Course: ${summary.courseTitle}`,
    `Training: ${summary.trainingType}`,
    `Session: ${summary.sessionLabel}${summary.preferredDate ? `; preferred date: ${summary.preferredDate}` : ''}`,
    `Name: ${summary.name}`,
    `Phone/WhatsApp: ${summary.phone}`,
    `Total fee: ${summary.totalLabel}`,
    `Deposit: ${summary.depositLabel}`,
    `Remaining balance: ${summary.balanceLabel}`,
    ...(paymentInstructionsAvailable ? ['After transferring externally through InstaPay, I will manually attach the payment screenshot in WhatsApp.'] : []),
    paymentInstructionsAvailable
      ? 'This is an enquiry only, not a confirmed reservation. Staff must verify payment and availability; the booking is confirmed only when the Academy team confirms directly.'
      : 'This is an enquiry only. It does not reserve a seat. The Academy team must confirm availability and verified payment instructions directly.',
  ].join('\n');
  return [
    'طلب حجز — استفسار فقط، وليس تأكيداً للحجز',
    `الدورة: ${summary.courseTitle}`,
    `نوع التدريب: ${summary.trainingType}`,
    `الموعد: ${summary.sessionLabel}${summary.preferredDate ? `؛ التاريخ المفضل: ${summary.preferredDate}` : ''}`,
    `الاسم: ${summary.name}`,
    `رقم الهاتف/واتساب: ${summary.phone}`,
    `إجمالي الرسوم: ${summary.totalLabel}`,
    `العربون: ${summary.depositLabel}`,
    `المتبقي بعد العربون: ${summary.balanceLabel}`,
    ...(paymentInstructionsAvailable ? ['بعد التحويل خارج الموقع عبر InstaPay، سأرفق صورة إثبات الدفع يدوياً في واتساب.'] : []),
    paymentInstructionsAvailable
      ? 'هذا استفسار فقط وليس تأكيداً للحجز. يجب أن يتحقق الفريق من الدفع والتوفر؛ ولا يتأكد الحجز إلا بعد تأكيد فريق الأكاديمية مباشرةً.'
      : 'هذا استفسار فقط ولا يحجز مقعداً. يجب أن يؤكد فريق الأكاديمية التوفر وتعليمات الدفع الموثقة مباشرةً.',
  ].join('\n');
}

export function buildBookingWhatsAppUrl(message, recipient) {
  const number = verifiedRecipient({ verified: true, number: recipient });
  if (!number || typeof message !== 'string' || !message.trim() || message.length > 5000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(message)) return null;
  const url = new URL(`https://wa.me/${number}`);
  url.searchParams.set('text', message);
  return url.href;
}

const copy = {
  en: {
    group: 'Group', private: 'One-to-One Private', chooseOption: 'Choose a training type', chooseSession: 'Choose a session',
    requestDate: 'Preferred date (optional)', privateSchedule: 'Private dates are arranged by request; this date is a preference only.',
    course: 'Course', training: 'Training type', session: 'Session or request', total: 'Total fee', deposit: 'Deposit', balance: 'Balance after deposit',
    name: 'Your name', phone: 'Phone or WhatsApp number', noSeat: 'This session has no verified places available. Choose another session or contact the Academy.',
    invalid: 'Review the highlighted fields before continuing.', stepError: 'Complete this step before continuing.', send: 'Prepare enquiry', copy: 'Copy booking message',
    nameError: 'Enter your name (up to 80 characters).', phoneError: 'Enter a phone number with 7–20 digits.', optionError: 'Choose an available training type.', sessionError: 'Choose a session with available places.', dateError: 'Enter a valid preferred date.',
    ready: 'Local demo message ready. Copy it to continue; nothing has been sent, saved, or reserved.', readyVerified: 'Your message is ready. Choose WhatsApp or copy it; nothing has been sent or reserved.', copied: 'Message copied. Nothing was sent, saved, or reserved by this website.', copyManual: 'Copy was unavailable. Select the message below and copy it manually.',
    paymentCopied: 'InstaPay identifier copied. This website did not transfer or verify any payment.', paymentCopyManual: 'Copy was unavailable. Select the identifier and copy it manually.',
    opened: 'Your WhatsApp draft is ready. If WhatsApp did not open, use the link below. Nothing was sent or booked by this website.',
    demo: 'LOCAL DEMO — illustrative course, schedule, price and availability only. No real offer or booking.',
    noContact: 'Booking actions are unavailable until the Academy contact destination is verified.',
    noOptions: 'Booking options will appear when verified dates, fees, deposits and conditions are available.',
    groupSizeError: 'Choose a requested group size from 1 to 6 doctors, or leave it blank.',
    enquiryDateHint: 'This date is a request only. The Academy team must confirm current scheduling options.',
    feeWholeGroup: 'total for the whole group', feeOneDoctor: 'for one doctor', depositPerBooking: 'per course booking',
    practicalGroup: 'One practical Implant case for the group', practicalPrivate: 'One practical Implant case for one doctor',
    participantsGroup: 'Requested group size is not an availability count.', participantsPrivate: 'One doctor',
    readyEnquiry: 'Your enquiry draft is ready. Choose WhatsApp or copy it; nothing has been sent, paid, reserved, or confirmed.',
    openedEnquiry: 'Your Academy enquiry draft is open in WhatsApp. Review it and choose whether to send; nothing is reserved or confirmed.',
  },
  ar: {
    group: 'مجموعة', private: 'تدريب فردي خاص', chooseOption: 'اختر نوع التدريب', chooseSession: 'اختر موعداً',
    requestDate: 'التاريخ المفضل (اختياري)', privateSchedule: 'تُرتب مواعيد التدريب الخاص حسب الطلب؛ هذا التاريخ تفضيل فقط.',
    course: 'الدورة', training: 'نوع التدريب', session: 'الموعد أو الطلب', total: 'إجمالي الرسوم', deposit: 'العربون', balance: 'المتبقي بعد العربون',
    name: 'الاسم', phone: 'رقم الهاتف أو واتساب', noSeat: 'لا توجد مقاعد متاحة موثقة في هذا الموعد. اختر موعداً آخر أو تواصل مع الأكاديمية.',
    invalid: 'راجع الحقول المحددة قبل المتابعة.', stepError: 'أكمل هذه الخطوة قبل المتابعة.', send: 'إعداد الاستفسار', copy: 'نسخ رسالة الحجز',
    nameError: 'أدخل اسمك (حتى ٨٠ حرفاً).', phoneError: 'أدخل رقم هاتف يحتوي على ٧ إلى ٢٠ رقماً.', optionError: 'اختر نوع تدريب متاحاً.', sessionError: 'اختر موعداً به مقاعد متاحة.', dateError: 'أدخل تاريخاً مفضلاً صحيحاً.',
    ready: 'رسالة النموذج المحلي جاهزة. انسخها للمتابعة؛ لم يرسل الموقع شيئاً ولم يحفظه أو يحجز مقعداً.', readyVerified: 'الرسالة جاهزة. اختر واتساب أو انسخها؛ لم تُرسل رسالة ولم يُحجز مقعد.', copied: 'نُسخت الرسالة. لم يُرسل الموقع أي شيء ولم يحفظه أو يحجز مقعداً.', copyManual: 'تعذر النسخ. حدد الرسالة أدناه وانسخها يدوياً.',
    paymentCopied: 'نُسخ معرّف InstaPay. لم ينفّذ الموقع تحويلاً ولم يتحقق من الدفع.', paymentCopyManual: 'تعذر النسخ. حدد المعرّف وانسخه يدوياً.',
    opened: 'مسودة واتساب جاهزة. إذا لم يفتح واتساب، استخدم الرابط أدناه. لم يرسل الموقع شيئاً ولم يحجز.',
    demo: 'نموذج محلي — الدورة والموعد والسعر والتوفر توضيحية فقط، وليست عرضاً أو حجزاً حقيقياً.',
    noContact: 'إجراءات الحجز غير متاحة إلى أن يتم التحقق من وسيلة التواصل مع الأكاديمية.',
    noOptions: 'تظهر خيارات الحجز بعد توفر مواعيد ورسوم وعربون وشروط موثقة.',
    groupSizeError: 'اختر حجماً مطلوباً للمجموعة من طبيب واحد إلى ٦ أطباء، أو اتركه فارغاً.',
    enquiryDateHint: 'هذا التاريخ طلب فقط. يجب أن يؤكد فريق الأكاديمية خيارات المواعيد الحالية.',
    feeWholeGroup: 'إجمالي المجموعة كاملة', feeOneDoctor: 'لطبيب واحد', depositPerBooking: 'لكل حجز دورة',
    practicalGroup: 'حالة زراعة عملية واحدة للمجموعة', practicalPrivate: 'حالة زراعة عملية واحدة لطبيب واحد',
    participantsGroup: 'الحجم المطلوب لا يعبّر عن التوفر الحالي.', participantsPrivate: 'طبيب واحد',
    readyEnquiry: 'مسودة الاستفسار جاهزة. اختر واتساب أو انسخها؛ لم يرسل الموقع أو يدفع أو يحجز أو يؤكد شيئاً.',
    openedEnquiry: 'فُتحت مسودة استفسارك للأكاديمية في واتساب. راجعها واختر إن كنت سترسلها؛ لم يُحجز أو يُؤكد شيء.',
  },
};

function initBooking(root = document) {
  const component = root.querySelector('[data-booking-component]');
  const courseData = root.querySelector('[data-course-booking-data]');
  const configData = root.querySelector('[data-course-booking-config]');
  if (!component || !courseData || !configData) return;
  const course = JSON.parse(courseData.textContent);
  const config = JSON.parse(configData.textContent);
  const lang = config.lang === 'ar' ? 'ar' : 'en';
  const text = copy[lang];
  const form = component.querySelector('[data-booking-form]');
  const optionInputs = [...form.querySelectorAll('input[name="optionId"]')];
  const sessionField = form.elements.namedItem('sessionId');
  const dateField = form.elements.namedItem('preferredDate');
  const groupSizeField = form.elements.namedItem('groupSize');
  const nameField = form.elements.namedItem('name');
  const phoneField = form.elements.namedItem('phone');
  const dateLabel = form.querySelector('[data-preferred-date-label]');
  const groupSizeLabel = form.querySelector('[data-group-size-label]');
  const sessionLabel = form.querySelector('[data-session-label]');
  const optionChoiceList = form.querySelector('.d2-training-choice-list');
  const status = component.querySelector('[data-booking-status]');
  const errors = component.querySelector('[data-booking-errors]');
  const summary = component.querySelector('[data-booking-summary]');
  const paymentSection = component.querySelector('[data-booking-payment]');
  const paymentName = component.querySelector('[data-payment-name]');
  const paymentIdentifier = component.querySelector('[data-payment-identifier]');
  const paymentInstructions = component.querySelector('[data-payment-instructions]');
  const paymentPolicy = component.querySelector('[data-payment-policy]');
  const paymentDemoWarning = component.querySelector('[data-payment-demo-warning]');
  const paymentCopyButton = component.querySelector('[data-payment-copy]');
  const paymentCopyStatus = component.querySelector('[data-payment-copy-status]');
  const messageField = component.querySelector('[data-booking-message]');
  const messageLabel = component.querySelector('[data-booking-message-label]');
  const copyButton = component.querySelector('[data-booking-copy]');
  const whatsappLink = component.querySelector('[data-booking-whatsapp]');
  const stepStatus = component.querySelector('[data-booking-step-status]');
  const progressItems = [...component.querySelectorAll('[data-booking-progress-item]')];
  const panels = [...component.querySelectorAll('[data-booking-step-panel]')];
  const output = key => component.querySelector(`[data-summary="${key}"]`);
  const enquiryOnly = config.enquiryOnly === true;
  const options = course.bookingOptions.filter(option => enquiryOnly
    ? option.enquiryEnabled === true && option.bookingEnabled !== true
    : option.bookingEnabled === true);
  const historyKey = '__implantGateAcademyBooking';
  let currentStep = 1;

  const readBookingHistoryState = () => {
    const state = window.history.state;
    return state && typeof state === 'object' && state[historyKey] && typeof state[historyKey] === 'object'
      ? state[historyKey]
      : {};
  };
  const selected = () => options.find(option => option.id === form.elements.namedItem('optionId').value) || null;
  const saveBookingHistoryState = () => {
    const current = window.history.state;
    const state = current && typeof current === 'object' ? current : {};
    const option = selected();
    const session = option?.schedulingMode === 'sessions'
      ? option.sessions.find(item => item.id === sessionField.value && item.availableSeats !== 0)
      : null;
    window.history.replaceState({
      ...state,
      [historyKey]: {
        step: Math.min(currentStep, 4),
        optionId: option?.id || '',
        sessionId: session?.id || '',
      },
    }, '', window.location.href);
  };
  const values = () => ({
    name: nameField.value,
    phone: phoneField.value,
    optionId: form.elements.namedItem('optionId').value,
    sessionId: sessionField.value,
    preferredDate: dateField.value,
    groupSize: groupSizeField?.value || '',
  });
  const setStep = (step, { focus = true, persist = true } = {}) => {
    currentStep = Math.max(1, Math.min(5, step));
    for (const panel of panels) panel.hidden = Number(panel.dataset.bookingStepPanel) !== currentStep;
    const currentProgressNumber = currentStep + 1;
    let currentLabel = '';
    for (const item of progressItems) {
      const index = Number(item.dataset.bookingProgressItem);
      item.removeAttribute('aria-current');
      item.dataset.complete = index < currentProgressNumber ? 'true' : 'false';
      if (index === currentProgressNumber) {
        item.setAttribute('aria-current', 'step');
        currentLabel = item.querySelector('.d2-booking-progress-label')?.textContent.trim() || '';
      }
    }
    const template = stepStatus?.dataset.template || '';
    if (stepStatus) stepStatus.textContent = template
      .replace('{current}', String(currentProgressNumber))
      .replace('{total}', String(progressItems.length))
      .replace('{label}', currentLabel);
    if (persist) saveBookingHistoryState();
    if (focus) {
      const heading = component.querySelector(`[data-booking-step-panel="${currentStep}"] [data-booking-step-heading]`);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  };
  const updateSessions = (preservedSessionId = sessionField.value) => {
    const option = selected();
    sessionField.replaceChildren(new Option(text.chooseSession, ''));
    if (enquiryOnly) {
      sessionField.required = false;
      sessionLabel.hidden = true;
      dateLabel.hidden = !option;
      if (groupSizeLabel) groupSizeLabel.hidden = option?.type !== 'group';
      if (option?.type !== 'group' && groupSizeField) groupSizeField.value = '';
      const dateHint = dateLabel.querySelector('small');
      if (dateHint) dateHint.textContent = text.enquiryDateHint;
      return;
    }
    if (option?.schedulingMode === 'sessions') {
      for (const session of option.sessions) {
        const label = formatSessionWindow(session, lang);
        const seats = Number.isSafeInteger(session.availableSeats) ? ` · ${session.availableSeats}` : '';
        const node = new Option(`${label}${seats}`, session.id);
        node.disabled = session.availableSeats === 0;
        sessionField.add(node);
      }
      sessionField.value = option.sessions.some(session => session.id === preservedSessionId && session.availableSeats !== 0)
        ? preservedSessionId
        : '';
      sessionField.required = true;
      sessionLabel.hidden = false;
      dateLabel.hidden = true;
    } else {
      sessionField.required = false;
      sessionLabel.hidden = true;
      dateLabel.hidden = option?.type !== 'private' || option.schedulingMode !== 'request';
    }
  };
  const updateSummary = () => {
    const detail = summarizeBooking(values(), course, lang, { enquiryOnly });
    summary.hidden = !detail.trainingType;
    const totalScope = detail.feeUnit === 'whole-group' ? text.feeWholeGroup
      : detail.feeUnit === 'per-doctor' ? text.feeOneDoctor : '';
    const total = [detail.totalLabel, totalScope].filter(Boolean).join(' · ');
    const depositScope = detail.depositUnit === 'per-course-booking' ? text.depositPerBooking : '';
    const deposit = [detail.depositLabel, depositScope].filter(Boolean).join(' · ');
    const participantRow = component.querySelector('[data-summary-row="participants"]');
    const caseRow = component.querySelector('[data-summary-row="case"]');
    if (participantRow) participantRow.hidden = !enquiryOnly;
    if (caseRow) caseRow.hidden = !enquiryOnly;
    const participants = detail.optionType === 'private'
      ? text.participantsPrivate
      : detail.groupSize
        ? `${detail.groupSize} ${lang === 'ar' ? 'أطباء' : 'doctors'} · ${text.participantsGroup}`
        : `${lang === 'ar' ? 'غير محدد' : 'Not specified'} · ${text.participantsGroup}`;
    const practicalCase = detail.optionType === 'group' ? text.practicalGroup
      : detail.optionType === 'private' ? text.practicalPrivate : '';
    for (const [key, value] of Object.entries({
      course: detail.courseTitle,
      training: detail.trainingType,
      session: detail.preferredDate ? `${detail.sessionLabel} · ${detail.preferredDate}` : detail.sessionLabel,
      total,
      deposit,
      balance: detail.balanceLabel,
      name: detail.name,
      phone: detail.phone,
      participants,
      case: practicalCase,
    })) if (output(key)) output(key).textContent = value || '—';
    const payment = paymentInstructionsForBooking(values(), course, config.academyPayment, lang);
    if (paymentSection) paymentSection.hidden = !payment;
    if (!payment) {
      if (paymentCopyStatus) paymentCopyStatus.textContent = '';
      return;
    }
    if (paymentName) paymentName.textContent = payment.displayName;
    if (paymentIdentifier) paymentIdentifier.textContent = payment.identifier;
    if (paymentInstructions) paymentInstructions.textContent = payment.depositInstructions;
    if (paymentPolicy) paymentPolicy.textContent = payment.paymentPolicy;
    if (paymentDemoWarning) paymentDemoWarning.hidden = !payment.localDemo;
    if (paymentCopyButton) paymentCopyButton.hidden = false;
    if (paymentCopyStatus) paymentCopyStatus.textContent = '';
  };
  const clearErrors = () => {
    errors.textContent = '';
    optionChoiceList?.removeAttribute('aria-describedby');
    for (const field of [...optionInputs, sessionField, dateField, groupSizeField, nameField, phoneField].filter(Boolean)) {
      field.setAttribute('aria-invalid', 'false');
      field.closest('label')?.removeAttribute('data-invalid');
    }
  };
  const clearPreparedMessage = () => {
    status.textContent = '';
    if (messageField) messageField.value = '';
    if (messageField) messageField.hidden = true;
    if (messageLabel) messageLabel.hidden = true;
    if (copyButton) copyButton.hidden = true;
    if (whatsappLink) {
      whatsappLink.hidden = true;
      whatsappLink.removeAttribute('href');
    }
  };
  const update = () => { updateSessions(); updateSummary(); clearPreparedMessage(); clearErrors(); };
  const restoreBookingUi = () => {
    const saved = readBookingHistoryState();
    const savedOption = options.find(option => option.id === saved.optionId);
    if (savedOption) for (const input of optionInputs) input.checked = input.value === savedOption.id;
    updateSessions(saved.sessionId || '');
    updateSummary();
    clearPreparedMessage();
    clearErrors();
    const savedStep = Number(saved.step);
    setStep(Number.isInteger(savedStep) && savedStep >= 1 && savedStep <= 4 ? savedStep : 1, { focus: false, persist: false });
    saveBookingHistoryState();
  };
  const showErrors = result => {
    const errorCopy = { name: text.nameError, phone: text.phoneError, optionId: text.optionError, sessionId: text.sessionError, preferredDate: text.dateError, groupSize: text.groupSizeError };
    const keys = Object.keys(result.errors);
    errors.textContent = keys.length ? [text.invalid, ...keys.map(key => errorCopy[key]).filter(Boolean)].join(' ') : text.stepError;
    if (result.errors.optionId) optionChoiceList?.setAttribute('aria-describedby', errors.id);
    else optionChoiceList?.removeAttribute('aria-describedby');
    for (const field of [...optionInputs, sessionField, dateField, groupSizeField, nameField, phoneField].filter(Boolean)) {
      const invalid = Boolean(result.errors[field.name]);
      field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      field.closest('label')?.toggleAttribute('data-invalid', invalid);
    }
    const firstError = ['optionId', 'sessionId', 'preferredDate', 'groupSize', 'name', 'phone'].find(key => result.errors[key]);
    const target = firstError === 'optionId' ? optionInputs[0]
      : firstError === 'sessionId' ? sessionField
        : firstError === 'preferredDate' ? dateField
          : firstError === 'groupSize' ? groupSizeField
            : firstError === 'name' ? nameField : phoneField;
    target?.focus();
    return false;
  };
  const continueStep = () => {
    const result = validateBookingStage(values(), course, currentStep, { enquiryOnly });
    if (!result.valid) return showErrors(result);
    clearErrors();
    setStep(currentStep + 1);
    return true;
  };

  for (const input of optionInputs) input.addEventListener('change', () => {
    sessionField.value = '';
    update();
    saveBookingHistoryState();
  });
  form.addEventListener('input', event => {
    updateSummary();
    clearPreparedMessage();
    errors.textContent = '';
    event.target.setAttribute('aria-invalid', 'false');
    event.target.closest('label')?.removeAttribute('data-invalid');
  });
  sessionField.addEventListener('change', () => { updateSummary(); clearPreparedMessage(); clearErrors(); saveBookingHistoryState(); });
  for (const button of form.querySelectorAll('[data-booking-next]')) button.addEventListener('click', continueStep);
  for (const button of form.querySelectorAll('[data-booking-back]')) button.addEventListener('click', () => {
    clearErrors();
    clearPreparedMessage();
    setStep(currentStep - 1);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (currentStep < 4) { continueStep(); return; }
    const input = values();
    const validation = validateBooking(input, course, { enquiryOnly });
    if (!validation.valid) {
      const errorStage = validation.errors.optionId ? 1
        : (validation.errors.sessionId || validation.errors.preferredDate || validation.errors.groupSize) ? 2 : 3;
      setStep(errorStage, { focus: false });
      showErrors(validation);
      return;
    }
    const payment = paymentInstructionsForBooking(input, course, config.academyPayment, lang);
    const message = formatBookingMessage(input, course, lang, { paymentInstructionsAvailable: Boolean(payment), enquiryOnly });
    if (!message) { errors.textContent = text.invalid; return; }
    if (!config.recipient && !config.localDemo) { errors.textContent = text.noContact; return; }
    if (config.recipient) {
      const url = buildBookingWhatsAppUrl(message, config.recipient);
      if (!url || !whatsappLink) { errors.textContent = text.noContact; return; }
      whatsappLink.href = url;
      whatsappLink.hidden = false;
    }
    messageField.value = message;
    if (messageLabel) messageLabel.hidden = true;
    if (copyButton) copyButton.hidden = false;
    setStep(5);
    status.textContent = enquiryOnly ? text.readyEnquiry : config.recipient ? text.readyVerified : text.ready;
  });
  whatsappLink?.addEventListener('click', () => { status.textContent = enquiryOnly ? text.openedEnquiry : text.opened; });
  copyButton?.addEventListener('click', async () => {
    const message = messageField.value;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message);
      else throw new Error('Clipboard API unavailable');
      status.textContent = text.copied;
    } catch {
      if (messageLabel) messageLabel.hidden = false;
      messageField.hidden = false;
      messageField.focus(); messageField.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual selection remains available. */ }
      status.textContent = copied ? text.copied : text.copyManual;
    }
  });
  paymentCopyButton?.addEventListener('click', async () => {
    const identifier = paymentIdentifier?.textContent || '';
    if (!identifier) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(identifier);
      if (paymentCopyStatus) paymentCopyStatus.textContent = text.paymentCopied;
    } catch {
      if (paymentIdentifier) {
        paymentIdentifier.focus();
        const range = document.createRange();
        range.selectNodeContents(paymentIdentifier);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      if (paymentCopyStatus) paymentCopyStatus.textContent = text.paymentCopyManual;
    }
  });
  restoreBookingUi();
  component.hidden = false;
  window.addEventListener('pageshow', restoreBookingUi);
}

if (typeof document !== 'undefined') initBooking();
