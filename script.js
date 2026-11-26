const config = window.SCHOOL_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
let supabase = null;
let backendPromise = null;
let notices = [];
let galleryItems = [];
let sitePages = [];
let feeItems = [];
let campusLocations = [];
let cmsLoaded = false;

const defaultSettings = {
  announcement: 'For current admission information, please contact the school.',
  address: 'Powayan, Shahjahanpur, Uttar Pradesh, India',
  map_query: 'Powayan, Shahjahanpur, Uttar Pradesh, India',
  phone: '',
  email: '',
  whatsapp: '',
  admissions_information: 'For current admission information, please contact the school.',
  school_history: 'School history will be shared here by the school.',
  school_mission: "The school's mission will be shared here by the school.",
  school_vision: "The school's vision and educational philosophy will be shared here by the school.",
  school_values: 'School values will be shared here by the school.',
  principal_name: 'Principal, Marwah Modern School',
  principal_message: 'A message from the Principal will be shared here by the school.',
  principal_photo_url: ''
};

const searchLinks = [
  { title: 'About the school', id: 'about', terms: 'about vision history principal values', cmsType: 'about' },
  { title: 'Academics', id: 'academics', terms: 'academics curriculum classes exams teaching calendar' },
  { title: 'Facilities', id: 'facilities', terms: 'facilities campus library transport' },
  { title: 'Admissions enquiry', id: 'admissions', terms: 'admissions apply enrol documents eligibility' },
  { title: 'Fee structure', id: 'fees', terms: 'fees fee structure tuition amounts', cmsType: 'fees' },
  { title: 'School gallery', id: 'gallery', terms: 'gallery photographs photos events' },
  { title: 'Notice board', id: 'notices', terms: 'notices announcements holidays examinations dates' },
  { title: 'Frequently asked questions', id: 'faq', terms: 'faq questions fees timings transport' },
  { title: 'Contact the school', id: 'contact', terms: 'contact phone email location address maps' }
];

function googleMapsEmbedUrl(query) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;
}

function googleMapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function setFormStatus(form, message, isError = false) {
  const status = form.querySelector('.form-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function setBusy(form, busy, label) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }
}

function applySettings(rawSettings = {}) {
  const settings = { ...defaultSettings, ...rawSettings };
  document.querySelectorAll('[data-setting]').forEach((element) => {
    const key = element.dataset.setting;
    if (key === 'phone' || key === 'email') return;
    element.textContent = settings[key] || defaultSettings[key] || '';
  });

  const phoneRow = document.querySelector('[data-contact-phone]');
  const phoneLink = document.querySelector('[data-setting="phone"]');
  if (settings.phone && phoneRow && phoneLink) {
    phoneRow.hidden = false;
    phoneLink.href = `tel:${settings.phone.replace(/[^\d+]/g, '')}`;
    phoneLink.querySelector('b').textContent = settings.phone;
  } else if (phoneRow) {
    phoneRow.hidden = true;
  }

  const emailRow = document.querySelector('[data-contact-email]');
  const emailLink = document.querySelector('[data-setting="email"]');
  if (settings.email && emailRow && emailLink) {
    emailRow.hidden = false;
    emailLink.href = `mailto:${settings.email}`;
    emailLink.querySelector('b').textContent = settings.email;
  } else if (emailRow) {
    emailRow.hidden = true;
  }

  const whatsapp = document.querySelector('[data-whatsapp]');
  const whatsappNumber = (settings.whatsapp || '').replace(/\D/g, '');
  if (whatsappNumber.length >= 10 && whatsappNumber.length <= 15) {
    whatsapp.href = `https://wa.me/${whatsappNumber}`;
    whatsapp.hidden = false;
  } else {
    whatsapp.hidden = true;
  }

  const mapQuery = settings.map_query || settings.address;
  const mapFrame = document.querySelector('[data-main-map]');
  mapFrame.src = googleMapsEmbedUrl(mapQuery);
  mapFrame.title = `Google Maps search for ${mapQuery}`;
  document.querySelector('[data-map-note]').textContent = `Google Maps search for ${mapQuery}; open Maps to verify the exact campus pin.`;
  document.querySelectorAll('[data-map-search]').forEach((link) => {
    link.href = googleMapsSearchUrl(mapQuery);
  });

  const principalPhoto = document.querySelector('[data-principal-photo]');
  if (principalPhoto && settings.principal_photo_url) {
    principalPhoto.src = settings.principal_photo_url;
    principalPhoto.alt = settings.principal_name
      ? `Portrait of ${settings.principal_name}`
      : 'Principal of Marwah Modern School';
  }

  return settings;
}

function formatNoticeDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '', month: '' };
  return {
    day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: date.toLocaleDateString('en-IN', { month: 'short' })
  };
}

function renderNotices(items) {
  const container = document.querySelector('#notice-list');
  if (!container) return;
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'notice-empty';
    const mark = document.createElement('span');
    mark.className = 'notice-empty-mark';
    mark.textContent = '—';
    const copy = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = 'No notices posted yet';
    const body = document.createElement('p');
    body.textContent = 'Please contact the school office for the latest announcements and dates.';
    copy.append(title, body);
    empty.append(mark, copy);
    container.append(empty);
    return;
  }

  items.forEach((notice) => {
    const date = formatNoticeDate(notice.published_at);
    const article = document.createElement('article');
    article.className = 'notice-item';
    const dateEl = document.createElement('time');
    dateEl.className = 'notice-date';
    dateEl.dateTime = notice.published_at;
    const day = document.createElement('b');
    day.textContent = date.day;
    const month = document.createElement('span');
    month.textContent = date.month;
    dateEl.append(day, month);
    const content = document.createElement('div');
    content.className = 'notice-content';
    const category = document.createElement('span');
    category.textContent = notice.category;
    const title = document.createElement('h3');
    title.textContent = notice.title;
    const body = document.createElement('p');
    body.textContent = notice.body;
    content.append(category, title, body);
    article.append(dateEl, content);
    container.append(article);
  });
}

function makeSearchResults(query) {
  const results = document.querySelector('.search-results');
  if (!results) return;
  results.replaceChildren();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return;

  const matches = searchLinks.filter((entry) => {
    if (entry.cmsType === 'fees' && !cmsLoaded) return false;
    if (cmsLoaded && entry.cmsType && !sitePages.some((page) => page.page_type === entry.cmsType && page.is_published)) return false;
    return `${entry.title} ${entry.terms}`.toLowerCase().includes(normalized);
  });
  if (!matches.length) {
    const empty = document.createElement('span');
    empty.textContent = 'No matching pages. Try “admissions” or “contact”.';
    empty.className = 'search-no-results';
    results.append(empty);
    return;
  }
  matches.forEach((entry) => {
    const link = document.createElement('a');
    link.href = `#${entry.id}`;
    link.textContent = entry.title;
    results.append(link);
  });
}

function renderGallery(items) {
  const grid = document.querySelector('#gallery-grid');
  if (!grid) return;
  grid.querySelectorAll('.gallery-dynamic').forEach((item) => item.remove());
  if (!items.length) return;
  const template = document.createDocumentFragment();
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-tile gallery-dynamic';
    button.dataset.lightbox = item.image_url;
    button.dataset.caption = item.caption;
    const image = document.createElement('img');
    image.src = item.image_url;
    image.alt = item.caption;
    image.loading = 'lazy';
    const caption = document.createElement('span');
    caption.className = 'gallery-caption';
    const title = document.createElement('b');
    title.textContent = item.caption;
    const subtitle = document.createElement('small');
    subtitle.textContent = 'Marwah Modern School';
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    caption.append(title, subtitle, arrow);
    button.append(image, caption);
    image.addEventListener('error', () => button.remove(), { once: true });
    template.append(button);
  });
  grid.prepend(template);
}

function renderFees(items) {
  const container = document.querySelector('#fees-table-wrap');
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'fees-empty';
    empty.textContent = 'Fee details have not been published yet. Please contact the school for confirmed information.';
    container.append(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'fees-table';
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Class / programme', 'Fee', 'Amount', 'Frequency', 'Notes'].forEach((label) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    headerRow.append(cell);
  });
  head.append(headerRow);
  const body = document.createElement('tbody');
  items.forEach((item) => {
    const row = document.createElement('tr');
    [item.class_name, item.fee_name, new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(Number(item.amount)), item.frequency, item.notes || '—'].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  container.append(table);
}

function renderManagedPages() {
  cmsLoaded = true;
  for (let index = searchLinks.length - 1; index >= 0; index -= 1) {
    if (searchLinks[index].dynamic) searchLinks.splice(index, 1);
  }
  const publishedPages = sitePages.filter((page) => page.is_published);
  const aboutPage = publishedPages.find((page) => page.page_type === 'about');
  const feesPage = publishedPages.find((page) => page.page_type === 'fees');
  const aboutSection = document.querySelector('#about');
  aboutSection.hidden = !aboutPage;
  document.querySelectorAll('[data-cms-nav="about"]').forEach((link) => {
    link.hidden = !aboutPage || !aboutPage.show_in_nav;
    if (aboutPage) link.textContent = aboutPage.nav_label;
  });
  if (aboutPage) {
    document.querySelector('[data-about-title]').textContent = aboutPage.title;
    document.querySelector('[data-about-summary]').textContent = aboutPage.summary;
    document.querySelector('[data-about-content]').textContent = aboutPage.content;
  }

  const feesSection = document.querySelector('#fees');
  feesSection.hidden = !feesPage;
  document.querySelectorAll('[data-cms-nav="fees"]').forEach((link) => {
    link.hidden = !feesPage || !feesPage.show_in_nav;
    if (feesPage) link.textContent = feesPage.nav_label;
  });
  if (feesPage) {
    document.querySelector('[data-fees-title]').textContent = feesPage.title;
    document.querySelector('[data-fees-summary]').textContent = feesPage.summary;
    document.querySelector('[data-fees-content]').textContent = feesPage.content;
    renderFees(feeItems);
  }

  const dynamicPages = document.querySelector('#dynamic-pages');
  dynamicPages.replaceChildren();
  document.querySelectorAll('.cms-dynamic-nav, .cms-dynamic-footer').forEach((link) => link.remove());
  publishedPages.filter((page) => page.page_type === 'custom').forEach((page) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) return;
    const section = document.createElement('section');
    section.className = 'custom-page section-pad';
    section.id = `page-${page.slug}`;
    const container = document.createElement('div');
    container.className = 'container custom-page-inner';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    const eyebrowRule = document.createElement('span');
    eyebrowRule.className = 'eyebrow-rule';
    eyebrow.append(eyebrowRule, ' SCHOOL INFORMATION');
    const title = document.createElement('h2');
    title.textContent = page.title;
    const summary = document.createElement('p');
    summary.className = 'custom-page-summary';
    summary.textContent = page.summary;
    const content = document.createElement('p');
    content.className = 'custom-page-content';
    content.textContent = page.content;
    container.append(eyebrow, title, summary, content);
    section.append(container);
    dynamicPages.append(section);

    if (page.show_in_nav) {
      const navLink = document.createElement('a');
      navLink.href = `#page-${page.slug}`;
      navLink.className = 'cms-dynamic-nav';
      navLink.textContent = page.nav_label;
      document.querySelector('#primary-nav .nav-cta').before(navLink);
      const footerLink = document.createElement('a');
      footerLink.href = `#page-${page.slug}`;
      footerLink.className = 'cms-dynamic-footer';
      footerLink.textContent = page.nav_label;
      document.querySelector('#cms-footer-links').append(footerLink);
    }
    searchLinks.push({
      title: page.title,
      id: `page-${page.slug}`,
      terms: `${page.slug} ${page.nav_label} ${page.summary}`,
      dynamic: true
    });
  });
}

function renderLocations(items) {
  const container = document.querySelector('#additional-locations');
  container.replaceChildren();
  const publishedLocations = items.filter((location) => location.is_published);
  container.hidden = publishedLocations.length === 0;
  publishedLocations.forEach((location) => {
    const card = document.createElement('article');
    card.className = 'map-card';
    const title = document.createElement('h3');
    title.textContent = location.name;
    const address = document.createElement('p');
    address.textContent = location.address;
    const map = document.createElement('iframe');
    map.src = googleMapsEmbedUrl(location.map_query);
    map.title = `Google Maps search for ${location.name}`;
    map.loading = 'lazy';
    map.referrerPolicy = 'no-referrer-when-downgrade';
    map.allowFullscreen = true;
    const link = document.createElement('a');
    link.href = googleMapsSearchUrl(location.map_query);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open in Google Maps ↗';
    card.append(title, address, map, link);
    container.append(card);
  });
}

async function loadPublicContent() {
  if (!supabase) return;
  const [settingsResponse, noticesResponse, galleryResponse, pagesResponse, feesResponse, locationsResponse] = await Promise.all([
    supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
    supabase.from('notices').select('id,title,body,category,published_at').eq('is_published', true).order('published_at', { ascending: false }),
    supabase.from('gallery').select('id,caption,image_url,storage_path').order('created_at', { ascending: false }),
    supabase.from('site_pages').select('*').eq('is_published', true).order('sort_order'),
    supabase.from('fee_items').select('*').order('sort_order').order('class_name'),
    supabase.from('campus_locations').select('*').eq('is_published', true).order('created_at')
  ]);
  if (settingsResponse.error) throw settingsResponse.error;
  if (noticesResponse.error) throw noticesResponse.error;
  if (galleryResponse.error) throw galleryResponse.error;
  if (pagesResponse.error) throw pagesResponse.error;
  if (feesResponse.error) throw feesResponse.error;
  if (locationsResponse.error) throw locationsResponse.error;
  applySettings(settingsResponse.data || {});
  notices = noticesResponse.data || [];
  galleryItems = galleryResponse.data || [];
  sitePages = pagesResponse.data || [];
  feeItems = feesResponse.data || [];
  campusLocations = locationsResponse.data || [];
  renderNotices(notices);
  renderGallery(galleryItems);
  renderManagedPages();
  renderLocations(campusLocations);
}

function showContactBackendNotice(form, description) {
  const message = configured
    ? `We couldn't send your ${description}. Please try again or contact the school directly.`
    : `Online ${description} are not set up yet. Please contact the school directly; contact details are not published.`;
  setFormStatus(form, message, true);
}

function setupEnquiryForms() {
  const admissionForm = document.querySelector('#admission-form');
  admissionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!admissionForm.reportValidity()) return;
    if (configured && !supabase && backendPromise) await backendPromise;
    if (!supabase) {
      showContactBackendNotice(admissionForm, 'admission enquiries');
      return;
    }

    const data = Object.fromEntries(new FormData(admissionForm));
    const studentName = data.student_name.trim();
    const parentName = data.parent_name.trim();
    const classInterest = data.class_interest.trim();
    if (studentName.length < 2 || parentName.length < 2 || !classInterest) {
      setFormStatus(admissionForm, 'Please enter the student, parent or guardian, and class details.', true);
      return;
    }
    setFormStatus(admissionForm, '');
    setBusy(admissionForm, true, 'Sending enquiry…');
    try {
      const { error } = await supabase.from('admission_enquiries').insert({
        student_name: studentName,
        parent_name: parentName,
        phone: data.phone.trim(),
        class_interest: classInterest,
        message: data.message.trim() || null
      });
      if (error) throw error;
      admissionForm.reset();
      setFormStatus(admissionForm, 'Thank you. Your admission enquiry has been submitted.');
    } catch (error) {
      console.error('Admission enquiry submission failed:', error);
      showContactBackendNotice(admissionForm, 'admission enquiry');
    } finally {
      setBusy(admissionForm, false);
    }
  });

  const contactForm = document.querySelector('#contact-form');
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    if (configured && !supabase && backendPromise) await backendPromise;
    if (!supabase) {
      showContactBackendNotice(contactForm, 'contact messages');
      return;
    }

    const data = Object.fromEntries(new FormData(contactForm));
    const name = data.name.trim();
    const email = data.email.trim();
    const phone = data.phone.trim();
    const message = data.message.trim();
    if (name.length < 2 || message.length < 5) {
      setFormStatus(contactForm, 'Please enter your name and a message with at least five characters.', true);
      return;
    }
    if (!email && !phone) {
      setFormStatus(contactForm, 'Please enter an email address or phone number so the school can respond.', true);
      return;
    }
    setFormStatus(contactForm, '');
    setBusy(contactForm, true, 'Sending message…');
    try {
      const { error } = await supabase.from('contact_messages').insert({
        name,
        email: email || null,
        phone: phone || null,
        message
      });
      if (error) throw error;
      contactForm.reset();
      setFormStatus(contactForm, 'Thank you. Your message has been submitted.');
    } catch (error) {
      console.error('Contact message submission failed:', error);
      showContactBackendNotice(contactForm, 'contact message');
    } finally {
      setBusy(contactForm, false);
    }
  });
}

function noticeDateForInput(value) {
  if (value) return value.slice(0, 10);
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function renderAdminNotices() {
  const container = document.querySelector('#admin-notices');
  container.replaceChildren();
  notices.forEach((notice) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const copy = document.createElement('p');
    const title = document.createElement('b');
    title.textContent = notice.title;
    const meta = document.createElement('small');
    meta.textContent = `${notice.category} · ${notice.published_at}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'admin-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      const form = document.querySelector('#notice-form');
      form.elements.id.value = notice.id;
      form.elements.title.value = notice.title;
      form.elements.body.value = notice.body;
      form.elements.category.value = notice.category;
      form.elements.published_at.value = noticeDateForInput(notice.published_at);
      form.querySelector('[type="submit"]').textContent = 'Update notice';
      form.querySelector('.notice-cancel').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteNotice(notice));
    actions.append(edit, remove);
    item.append(copy, actions);
    container.append(item);
  });
}

function renderAdminPages() {
  const container = document.querySelector('#admin-pages');
  container.replaceChildren();
  sitePages.forEach((page) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const copy = document.createElement('p');
    const title = document.createElement('b');
    title.textContent = page.title;
    const meta = document.createElement('small');
    meta.textContent = `${page.page_type} · ${page.is_published ? 'Published' : 'Hidden'} · ${page.slug}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'admin-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      const form = document.querySelector('#page-form');
      form.elements.original_slug.value = page.slug;
      form.elements.page_type.value = page.page_type;
      form.elements.slug.value = page.slug;
      form.elements.slug.readOnly = page.page_type !== 'custom';
      form.elements.nav_label.value = page.nav_label;
      form.elements.title.value = page.title;
      form.elements.summary.value = page.summary;
      form.elements.content.value = page.content;
      form.elements.is_published.checked = page.is_published;
      form.elements.show_in_nav.checked = page.show_in_nav;
      form.querySelector('[type="submit"]').textContent = 'Update page';
      form.querySelector('.page-cancel').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteSitePage(page));
    actions.append(edit, remove);
    item.append(copy, actions);
    container.append(item);
  });
}

function renderAdminFees() {
  const container = document.querySelector('#admin-fees');
  container.replaceChildren();
  feeItems.forEach((fee) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const copy = document.createElement('p');
    const title = document.createElement('b');
    title.textContent = `${fee.class_name} · ${fee.fee_name}`;
    const meta = document.createElement('small');
    meta.textContent = `₹${Number(fee.amount).toLocaleString('en-IN')} · ${fee.frequency}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'admin-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      const form = document.querySelector('#fee-form');
      form.elements.id.value = fee.id;
      form.elements.class_name.value = fee.class_name;
      form.elements.fee_name.value = fee.fee_name;
      form.elements.amount.value = fee.amount;
      form.elements.frequency.value = fee.frequency;
      form.elements.notes.value = fee.notes || '';
      form.querySelector('[type="submit"]').textContent = 'Update fee item';
      form.querySelector('.fee-cancel').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteFeeItem(fee));
    actions.append(edit, remove);
    item.append(copy, actions);
    container.append(item);
  });
}

function renderAdminLocations() {
  const container = document.querySelector('#admin-locations');
  container.replaceChildren();
  campusLocations.forEach((location) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const copy = document.createElement('p');
    const title = document.createElement('b');
    title.textContent = location.name;
    const meta = document.createElement('small');
    meta.textContent = `${location.address} · ${location.is_published ? 'Published' : 'Hidden'}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'admin-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      const form = document.querySelector('#location-form');
      form.elements.id.value = location.id;
      form.elements.name.value = location.name;
      form.elements.address.value = location.address;
      form.elements.map_query.value = location.map_query;
      form.elements.is_published.checked = location.is_published;
      form.querySelector('[type="submit"]').textContent = 'Update location';
      form.querySelector('.location-cancel').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteCampusLocation(location));
    actions.append(edit, remove);
    item.append(copy, actions);
    container.append(item);
  });
}

async function refreshAdminData() {
  const [noticeResponse, galleryResponse, settingsResponse, admissionResponse, contactResponse, pagesResponse, feesResponse, locationsResponse] = await Promise.all([
    supabase.from('notices').select('*').order('published_at', { ascending: false }),
    supabase.from('gallery').select('*').order('created_at', { ascending: false }),
    supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
    supabase.from('admission_enquiries').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('site_pages').select('*').order('sort_order'),
    supabase.from('fee_items').select('*').order('sort_order').order('class_name'),
    supabase.from('campus_locations').select('*').order('created_at')
  ]);
  if (noticeResponse.error) throw noticeResponse.error;
  if (galleryResponse.error) throw galleryResponse.error;
  if (settingsResponse.error) throw settingsResponse.error;
  if (admissionResponse.error) throw admissionResponse.error;
  if (contactResponse.error) throw contactResponse.error;
  if (pagesResponse.error) throw pagesResponse.error;
  if (feesResponse.error) throw feesResponse.error;
  if (locationsResponse.error) throw locationsResponse.error;
  notices = noticeResponse.data || [];
  galleryItems = galleryResponse.data || [];
  sitePages = pagesResponse.data || [];
  feeItems = feesResponse.data || [];
  campusLocations = locationsResponse.data || [];
  renderNotices(notices.filter((notice) => notice.is_published));
  renderAdminNotices();
  renderAdminPages();
  renderAdminFees();
  renderAdminLocations();
  renderAdminGallery();
  renderAdminEnquiries(admissionResponse.data || [], contactResponse.data || []);

  const settings = applySettings(settingsResponse.data || {});
  renderManagedPages();
  renderLocations(campusLocations);
  const settingsForm = document.querySelector('#settings-form');
  Object.keys(settings).forEach((key) => {
    if (settingsForm.elements[key]) settingsForm.elements[key].value = settings[key] || '';
  });
}

function renderAdminGallery() {
  const container = document.querySelector('#admin-gallery');
  container.replaceChildren();
  galleryItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'admin-gallery-item';
    const image = document.createElement('img');
    image.src = item.image_url;
    image.alt = item.caption;
    image.loading = 'lazy';
    const caption = document.createElement('p');
    caption.textContent = item.caption;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete photo';
    remove.addEventListener('click', () => deleteGalleryItem(item));
    card.append(image, caption, remove);
    container.append(card);
  });
}

function renderAdminEnquiries(admissionRows, contactRows) {
  const container = document.querySelector('#admin-enquiries');
  container.replaceChildren();
  const rows = [
    ...admissionRows.map((row) => ({ ...row, enquiryType: 'Admission enquiry' })),
    ...contactRows.map((row) => ({ ...row, enquiryType: 'Contact message' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'No enquiries have been received yet.';
    container.append(empty);
    return;
  }

  rows.forEach((row) => {
    const details = document.createElement('details');
    details.className = 'admin-enquiry';
    const summary = document.createElement('summary');
    const name = document.createElement('b');
    name.textContent = row.student_name ? `${row.student_name} · ${row.parent_name}` : row.name;
    const meta = document.createElement('small');
    const classInfo = row.class_interest ? ` · Class: ${row.class_interest}` : '';
    meta.textContent = `${row.enquiryType}${classInfo} · ${new Date(row.created_at).toLocaleString('en-IN')}`;
    summary.append(name, meta);
    const body = document.createElement('div');
    body.className = 'admin-enquiry-body';
    const contact = document.createElement('p');
    const channels = [];
    if (row.phone) {
      const phone = document.createElement('a');
      phone.href = `tel:${row.phone.replace(/[^\d+]/g, '')}`;
      phone.textContent = row.phone;
      channels.push(phone);
    }
    if (row.email) {
      const email = document.createElement('a');
      email.href = `mailto:${row.email}`;
      email.textContent = row.email;
      channels.push(email);
    }
    channels.forEach((link, index) => {
      if (index) contact.append(' · ');
      contact.append(link);
    });
    const message = document.createElement('p');
    message.textContent = row.message || 'No additional message.';
    body.append(contact, message);
    details.append(summary, body);
    container.append(details);
  });
}

async function deleteNotice(notice) {
  if (!window.confirm(`Delete “${notice.title}”?`)) return;
  try {
    const { error } = await supabase.from('notices').delete().eq('id', notice.id);
    if (error) throw error;
    await refreshAdminData();
  } catch (error) {
    console.error('Notice deletion failed:', error);
    setFormStatus(document.querySelector('#notice-form'), 'The notice could not be deleted. Check your administrator access and try again.', true);
  }
}

async function deleteSitePage(page) {
  if (!window.confirm(`Remove the “${page.title}” page from the site?`)) return;
  try {
    const { error } = await supabase.from('site_pages').delete().eq('slug', page.slug);
    if (error) throw error;
    await refreshAdminData();
  } catch (error) {
    console.error('Page deletion failed:', error);
    setFormStatus(document.querySelector('#page-form'), 'The page could not be removed. Check your administrator access and try again.', true);
  }
}

async function deleteFeeItem(fee) {
  if (!window.confirm(`Delete “${fee.fee_name}” for ${fee.class_name}?`)) return;
  try {
    const { error } = await supabase.from('fee_items').delete().eq('id', fee.id);
    if (error) throw error;
    await refreshAdminData();
  } catch (error) {
    console.error('Fee item deletion failed:', error);
    setFormStatus(document.querySelector('#fee-form'), 'The fee item could not be deleted. Check your administrator access and try again.', true);
  }
}

async function deleteCampusLocation(location) {
  if (!window.confirm(`Remove the “${location.name}” map location?`)) return;
  try {
    const { error } = await supabase.from('campus_locations').delete().eq('id', location.id);
    if (error) throw error;
    await refreshAdminData();
  } catch (error) {
    console.error('Map location deletion failed:', error);
    setFormStatus(document.querySelector('#location-form'), 'The map location could not be removed. Check your administrator access and try again.', true);
  }
}

async function deleteGalleryItem(item) {
  if (!window.confirm(`Delete the photo “${item.caption}”?`)) return;
  try {
    if (item.storage_path) {
      const { error: storageError } = await supabase.storage.from('school-gallery').remove([item.storage_path]);
      if (storageError) throw storageError;
    }
    const { error } = await supabase.from('gallery').delete().eq('id', item.id);
    if (error) throw error;
    await refreshAdminData();
  } catch (error) {
    console.error('Gallery image deletion failed:', error);
    setFormStatus(document.querySelector('#gallery-form'), 'The photo could not be deleted. Check your administrator access and try again.', true);
  }
}

function setupAdmin() {
  const dialog = document.querySelector('#admin-dialog');
  const login = document.querySelector('#admin-login');
  const dashboard = document.querySelector('.admin-dashboard');
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'admin-access';
  openButton.textContent = 'Administrator';
  openButton.setAttribute('aria-label', 'Open administrator portal');
  document.querySelector('.footer-bottom-inner').append(openButton);
  openButton.addEventListener('click', () => dialog.showModal());
  document.querySelector('.admin-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', async () => {
    document.body.classList.remove('dialog-open');
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Administrator sign-out failed:', error);
      dashboard.hidden = true;
      login.hidden = false;
    }
  });
  dialog.addEventListener('close', () => {
    const button = document.querySelector('.admin-access');
    if (button) button.focus();
  });
  dialog.addEventListener('cancel', () => document.body.classList.remove('dialog-open'));
  openButton.addEventListener('click', () => {
    document.body.classList.add('dialog-open');
    if (!configured) {
      setFormStatus(login, 'The secure admin backend is not configured. See ADMIN_SETUP.md before using this portal.', true);
    } else if (!supabase) {
      setFormStatus(login, 'The admin service could not be loaded. Refresh the page and check the connection.', true);
    }
  });

  login.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (configured && !supabase && backendPromise) await backendPromise;
    if (!supabase) {
      setFormStatus(login, 'The secure admin backend is not configured.', true);
      return;
    }
    setFormStatus(login, '');
    setBusy(login, true, 'Signing in…');
    const data = new FormData(login);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.get('email'),
        password: data.get('password')
      });
      if (authError) throw authError;
      const { data: admin, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();
      if (adminError) throw adminError;
      if (!admin) {
        await supabase.auth.signOut();
        throw new Error('This account is not authorised as a school administrator.');
      }
      login.hidden = true;
      dashboard.hidden = false;
      document.querySelector('[data-admin-email]').textContent = authData.user.email;
      await refreshAdminData();
    } catch (error) {
      console.error('Administrator sign-in failed:', error);
      dashboard.hidden = true;
      login.hidden = false;
      await supabase.auth.signOut();
      setFormStatus(login, error.message || 'Sign-in failed. Check your details and try again.', true);
    } finally {
      setBusy(login, false);
    }
  });

  document.querySelector('.admin-logout').addEventListener('click', async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Administrator sign-out failed:', error);
      return;
    }
    dashboard.hidden = true;
    login.hidden = false;
    login.reset();
    setFormStatus(login, 'You have signed out.');
  });

  const settingsForm = document.querySelector('#settings-form');
  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = Object.fromEntries(new FormData(settingsForm));
    const update = {
      id: 'main',
      announcement: data.announcement.trim(),
      address: data.address.trim(),
      map_query: data.map_query.trim() || data.address.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      whatsapp: data.whatsapp.replace(/\D/g, ''),
      admissions_information: data.admissions_information.trim(),
      school_history: data.school_history.trim(),
      school_mission: data.school_mission.trim(),
      school_vision: data.school_vision.trim(),
      school_values: data.school_values.trim(),
      principal_name: data.principal_name.trim(),
      principal_message: data.principal_message.trim()
    };
    setBusy(settingsForm, true, 'Saving…');
    setFormStatus(settingsForm, '');
    try {
      const { error } = await supabase.from('site_settings').upsert(update, { onConflict: 'id' });
      if (error) throw error;
      applySettings(update);
      setFormStatus(settingsForm, 'School information updated.');
    } catch (error) {
      console.error('School information update failed:', error);
      setFormStatus(settingsForm, 'Information could not be saved. Check your administrator access and try again.', true);
    } finally {
      setBusy(settingsForm, false);
    }
  });

  const pageForm = document.querySelector('#page-form');
  const pageType = pageForm.elements.page_type;
  const pageSlug = pageForm.elements.slug;
  const pageCancel = pageForm.querySelector('.page-cancel');
  pageType.addEventListener('change', () => {
    if (pageType.value === 'custom') {
      if (pageSlug.value === 'about' || pageSlug.value === 'fees') pageSlug.value = '';
      if (pageForm.elements.nav_label.value === 'About' || pageForm.elements.nav_label.value === 'Fees') {
        pageForm.elements.nav_label.value = '';
      }
      pageSlug.readOnly = false;
      return;
    }
    pageSlug.value = pageType.value;
    pageSlug.readOnly = true;
    if (!pageForm.elements.nav_label.value || pageForm.elements.nav_label.value === 'About' || pageForm.elements.nav_label.value === 'Fees') {
      pageForm.elements.nav_label.value = pageType.value === 'about' ? 'About' : 'Fees';
    }
  });
  pageCancel.addEventListener('click', () => {
    pageForm.reset();
    pageForm.elements.original_slug.value = '';
    pageSlug.readOnly = false;
    pageForm.querySelector('[type="submit"]').textContent = 'Save page';
    pageCancel.hidden = true;
    setFormStatus(pageForm, '');
  });
  pageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = Object.fromEntries(new FormData(pageForm));
    const originalSlug = data.original_slug;
    const type = data.page_type;
    const record = {
      slug: type === 'custom' ? data.slug.trim() : type,
      page_type: type,
      title: data.title.trim(),
      nav_label: data.nav_label.trim(),
      summary: data.summary.trim(),
      content: data.content.trim(),
      is_published: pageForm.elements.is_published.checked,
      show_in_nav: pageForm.elements.show_in_nav.checked,
      sort_order: sitePages.find((page) => page.slug === originalSlug)?.sort_order || (sitePages.length + 1) * 10,
      updated_at: new Date().toISOString()
    };
    setBusy(pageForm, true, 'Saving page…');
    setFormStatus(pageForm, '');
    try {
      const response = originalSlug
        ? await supabase.from('site_pages').update(record).eq('slug', originalSlug)
        : await supabase.from('site_pages').insert(record);
      if (response.error) throw response.error;
      pageForm.reset();
      pageForm.elements.original_slug.value = '';
      pageSlug.readOnly = false;
      pageForm.querySelector('[type="submit"]').textContent = 'Save page';
      pageCancel.hidden = true;
      await refreshAdminData();
      setFormStatus(pageForm, 'Page saved.');
    } catch (error) {
      console.error('Page save failed:', error);
      setFormStatus(pageForm, 'The page could not be saved. Check its slug and administrator access.', true);
    } finally {
      setBusy(pageForm, false);
    }
  });

  const feeForm = document.querySelector('#fee-form');
  const feeCancel = feeForm.querySelector('.fee-cancel');
  feeCancel.addEventListener('click', () => {
    feeForm.reset();
    feeForm.elements.id.value = '';
    feeForm.querySelector('[type="submit"]').textContent = 'Save fee item';
    feeCancel.hidden = true;
    setFormStatus(feeForm, '');
  });
  feeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = Object.fromEntries(new FormData(feeForm));
    const record = {
      class_name: data.class_name.trim(),
      fee_name: data.fee_name.trim(),
      amount: Number(data.amount),
      frequency: data.frequency,
      notes: data.notes.trim()
    };
    setBusy(feeForm, true, 'Saving fee…');
    setFormStatus(feeForm, '');
    try {
      const response = data.id
        ? await supabase.from('fee_items').update(record).eq('id', data.id)
        : await supabase.from('fee_items').insert(record);
      if (response.error) throw response.error;
      feeForm.reset();
      feeForm.elements.id.value = '';
      feeForm.querySelector('[type="submit"]').textContent = 'Save fee item';
      feeCancel.hidden = true;
      await refreshAdminData();
      setFormStatus(feeForm, 'Fee item saved.');
    } catch (error) {
      console.error('Fee item save failed:', error);
      setFormStatus(feeForm, 'The fee item could not be saved. Check the amount and administrator access.', true);
    } finally {
      setBusy(feeForm, false);
    }
  });

  const locationForm = document.querySelector('#location-form');
  const locationCancel = locationForm.querySelector('.location-cancel');
  locationCancel.addEventListener('click', () => {
    locationForm.reset();
    locationForm.elements.id.value = '';
    locationForm.querySelector('[type="submit"]').textContent = 'Save location';
    locationCancel.hidden = true;
    setFormStatus(locationForm, '');
  });
  locationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = Object.fromEntries(new FormData(locationForm));
    const record = {
      name: data.name.trim(),
      address: data.address.trim(),
      map_query: data.map_query.trim(),
      is_published: locationForm.elements.is_published.checked
    };
    setBusy(locationForm, true, 'Saving location…');
    setFormStatus(locationForm, '');
    try {
      const response = data.id
        ? await supabase.from('campus_locations').update(record).eq('id', data.id)
        : await supabase.from('campus_locations').insert(record);
      if (response.error) throw response.error;
      locationForm.reset();
      locationForm.elements.id.value = '';
      locationForm.querySelector('[type="submit"]').textContent = 'Save location';
      locationCancel.hidden = true;
      await refreshAdminData();
      setFormStatus(locationForm, 'Map location saved.');
    } catch (error) {
      console.error('Map location save failed:', error);
      setFormStatus(locationForm, 'The map location could not be saved. Check the details and administrator access.', true);
    } finally {
      setBusy(locationForm, false);
    }
  });

  const noticeForm = document.querySelector('#notice-form');
  const cancelEdit = noticeForm.querySelector('.notice-cancel');
  cancelEdit.addEventListener('click', () => {
    noticeForm.reset();
    noticeForm.elements.id.value = '';
    noticeForm.querySelector('[type="submit"]').textContent = 'Save notice';
    cancelEdit.hidden = true;
    setFormStatus(noticeForm, '');
  });
  noticeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = Object.fromEntries(new FormData(noticeForm));
    const record = {
      title: data.title.trim(),
      body: data.body.trim(),
      category: data.category,
      published_at: data.published_at,
      is_published: true
    };
    setBusy(noticeForm, true, 'Saving…');
    setFormStatus(noticeForm, '');
    try {
      const response = data.id
        ? await supabase.from('notices').update(record).eq('id', data.id)
        : await supabase.from('notices').insert(record);
      if (response.error) throw response.error;
      noticeForm.reset();
      noticeForm.elements.id.value = '';
      noticeForm.querySelector('[type="submit"]').textContent = 'Save notice';
      cancelEdit.hidden = true;
      await refreshAdminData();
      setFormStatus(noticeForm, 'Notice published.');
    } catch (error) {
      console.error('Notice save failed:', error);
      setFormStatus(noticeForm, 'The notice could not be saved. Check your administrator access and try again.', true);
    } finally {
      setBusy(noticeForm, false);
    }
  });

  const galleryForm = document.querySelector('#gallery-form');
  galleryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(galleryForm);
    const file = data.get('image');
    if (!(file instanceof File) || !file.size) {
      setFormStatus(galleryForm, 'Choose an image to upload.', true);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setFormStatus(galleryForm, 'Choose a JPEG, PNG or WebP image smaller than 8 MB.', true);
      return;
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `gallery/${crypto.randomUUID()}.${extension}`;
    setBusy(galleryForm, true, 'Uploading…');
    setFormStatus(galleryForm, '');
    try {
      const { error: uploadError } = await supabase.storage.from('school-gallery').upload(path, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('school-gallery').getPublicUrl(path);
      const { error: insertError } = await supabase.from('gallery').insert({
        caption: String(data.get('caption')).trim(),
        image_url: publicUrl.publicUrl,
        storage_path: path
      });
      if (insertError) {
        await supabase.storage.from('school-gallery').remove([path]);
        throw insertError;
      }
      galleryForm.reset();
      await refreshAdminData();
      renderGallery(galleryItems);
      setFormStatus(galleryForm, 'Photo uploaded to the school gallery.');
    } catch (error) {
      console.error('Gallery image upload failed:', error);
      setFormStatus(galleryForm, 'The photo could not be uploaded. Check file size, administrator access and storage setup.', true);
    } finally {
      setBusy(galleryForm, false);
    }
  });

  const principalForm = document.querySelector('#principal-photo-form');
  principalForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const file = new FormData(principalForm).get('image');
    if (!(file instanceof File) || !file.size) {
      setFormStatus(principalForm, 'Choose a portrait to upload.', true);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setFormStatus(principalForm, 'Choose a JPEG, PNG or WebP image smaller than 8 MB.', true);
      return;
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `principal/${crypto.randomUUID()}.${extension}`;
    setBusy(principalForm, true, 'Uploading…');
    setFormStatus(principalForm, '');
    try {
      const { error: uploadError } = await supabase.storage.from('school-gallery').upload(path, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('school-gallery').getPublicUrl(path);
      const { error } = await supabase.from('site_settings').upsert({
        id: 'main',
        principal_photo_url: publicUrl.publicUrl
      }, { onConflict: 'id' });
      if (error) {
        await supabase.storage.from('school-gallery').remove([path]);
        throw error;
      }
      applySettings({ principal_photo_url: publicUrl.publicUrl });
      principalForm.reset();
      setFormStatus(principalForm, 'Principal photograph updated.');
    } catch (error) {
      console.error('Principal photograph upload failed:', error);
      setFormStatus(principalForm, 'The portrait could not be uploaded. Check file size, administrator access and storage setup.', true);
    } finally {
      setBusy(principalForm, false);
    }
  });
}

async function initializeBackend() {
  if (!configured) return;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    await loadPublicContent();
  } catch (error) {
    supabase = null;
    console.error('The Supabase school website backend could not be initialized:', error);
  }
}

function setupNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('is-open', !expanded);
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      nav.classList.remove('is-open');
    }
  });

  const searchPanel = document.querySelector('.search-panel');
  const searchInput = document.querySelector('#site-search');
  document.querySelector('.search-open').addEventListener('click', () => {
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) searchInput.focus();
  });
  document.querySelector('.search-close').addEventListener('click', () => {
    searchPanel.hidden = true;
  });
  searchInput.addEventListener('input', () => makeSearchResults(searchInput.value));
  document.querySelector('.search-results').addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    searchPanel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    nav.classList.remove('is-open');
  });

  const backToTop = document.querySelector('.back-to-top');
  window.addEventListener('scroll', () => {
    const show = window.scrollY > 560;
    backToTop.hidden = !show;
    backToTop.classList.toggle('is-visible', show);
  }, { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.querySelector('#current-year').textContent = new Date().getFullYear();

  const lightbox = document.querySelector('#lightbox');
  const lightboxImage = lightbox.querySelector('img');
  document.querySelector('#gallery-grid').addEventListener('click', (event) => {
    const tile = event.target.closest('[data-lightbox]');
    if (!tile) return;
    if (!tile.classList.contains('gallery-dynamic') && tile.dataset.realPhoto !== 'true') return;
    const image = tile.querySelector('img');
    if (!image || (image.complete && image.naturalWidth === 0)) return;
    lightboxImage.src = tile.dataset.lightbox;
    lightboxImage.alt = image ? image.alt : tile.dataset.caption;
    lightbox.querySelector('p').textContent = tile.dataset.caption;
    lightbox.hidden = false;
    document.body.classList.add('dialog-open');
    lightbox.querySelector('.lightbox-close').focus();
  });
  const closeLightbox = () => {
    lightbox.hidden = true;
    lightboxImage.removeAttribute('src');
    document.body.classList.remove('dialog-open');
  };
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });

  document.querySelectorAll('.hero-photo, .about-photo-frame > img, .gallery-tile > img').forEach((image) => {
    const hideUnavailableImage = () => image.remove();
    image.addEventListener('error', hideUnavailableImage, { once: true });
    if (image.complete && image.naturalWidth === 0) hideUnavailableImage();
  });
  const principalPhoto = document.querySelector('[data-principal-photo]');
  principalPhoto.addEventListener('error', () => {
    principalPhoto.src = 'assets/principal-placeholder.svg';
    principalPhoto.alt = 'Principal portrait placeholder';
  }, { once: true });
}

function setupRevealAnimations() {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const revealTargets = document.querySelectorAll('.welcome-card, .academic-card, .gallery-empty, .facility-note, .faq-list details');
  revealTargets.forEach((element) => element.classList.add('reveal'));
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach((element) => observer.observe(element));
}

function setupSchoolBuildingImage() {
  const imagePath = config.schoolBuildingImage;
  if (typeof imagePath !== 'string' || !imagePath.trim()) return;
  document.querySelectorAll('.hero-photo, .about-photo-frame > img, .gallery-building > img').forEach((image) => {
    image.src = imagePath.trim();
    image.alt = 'Marwah Modern School building in Powayan';
  });
  const galleryTile = document.querySelector('.gallery-building');
  galleryTile.dataset.lightbox = imagePath.trim();
  galleryTile.dataset.realPhoto = 'true';
}

applySettings();
setupSchoolBuildingImage();
setupNavigation();
setupEnquiryForms();
setupAdmin();
setupRevealAnimations();
backendPromise = initializeBackend();
backendPromise.catch((error) => {
  console.error('Website content could not be loaded:', error);
});
