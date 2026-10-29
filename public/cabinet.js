// ATLAS personal cabinet: readers, advertisers, editors and administrators.
// On GitHub Pages a scripted demo API (cabinet-demo.js) replaces the real backend.

const T = {
  ru: {
    cabinet: 'Личный кабинет', site: '← На сайт', logout: 'Выйти', signin: 'Вход', signup: 'Регистрация', email: 'Email', password: 'Пароль', name: 'Имя',
    company: 'Компания', iam: 'Я', reader: 'Читатель', advertiser: 'Рекламодатель', editor: 'Редактор', admin: 'Администратор', submitSignin: 'Войти', submitSignup: 'Создать аккаунт',
    profile: 'Профиль', bookmarks: 'Закладки', campaigns: 'Реклама', newsroom: 'Редакция', moderation: 'Модерация', payments: 'Платежи', users: 'Пользователи', telegram: 'Telegram',
    save: 'Сохранить', saved: 'Сохранено', language: 'Язык', topics: 'Мои разделы', channels: 'Telegram-каналы ваших разделов', channelSoon: 'канал готовится', noBookmarks: 'Пока нет закладок. Сохраняйте материалы на сайте.',
    newCampaign: 'Новая кампания', campaignName: 'Название кампании', placement: 'Размещение', sections: 'Разделы', languages: 'Языки аудитории', adTitle: 'Заголовок объявления', adText: 'Текст объявления',
    clickUrl: 'Ссылка (https://)', advertiserName: 'Рекламодатель в маркировке', erid: 'erid (токен ОРД)', eridHint: 'Для рекламы на русском языке нужна маркировка: получите erid в операторе рекламных данных (ОРД).',
    startDate: 'Дата старта', days: 'Дней', total: 'Итого', create: 'Сохранить черновик', submit: 'Отправить на модерацию', pay: 'Оплатить', edit: 'Изменить', preview: 'Предпросмотр',
    status: 'Статус', price: 'Цена', impressions: 'Показы', clicks: 'Клики', ctr: 'CTR', noCampaigns: 'Кампаний пока нет.', becomeAdvertiser: 'Стать рекламодателем',
    becomeHint: 'Размещайте объявления в ленте, в статьях и в Telegram-каналах ATLAS. Объявления проходят модерацию до оплаты.',
    payWith: 'Способ оплаты', invoice: 'Счёт', reference: 'Номер платежа', openInvoice: 'Открыть страницу оплаты', approve: 'Одобрить', reject: 'Отклонить', note: 'Комментарий',
    confirmPaid: 'Подтвердить оплату', nothing: 'Пусто.', runNow: 'Запустить агентов сейчас', runs: 'Запуски агентов', reviewQueue: 'Очередь проверки', openReview: 'Открыть очередь на сайте →',
    published: 'Опубликовано', held: 'На проверке', rejected: 'Отклонено', errors: 'Ошибки', role: 'Роль', channel: 'Канал', when: 'Когда',
    statuses: {draft: 'Черновик', moderation: 'На модерации', awaiting_payment: 'Ожидает оплаты', scheduled: 'Оплачено, ждёт старта', active: 'Показывается', completed: 'Завершена', rejected: 'Отклонена', pending: 'Ожидает', paid: 'Оплачен', failed: 'Ошибка', partial: 'Частично', queued: 'В очереди', running: 'Идёт', done: 'Готово', interrupted: 'Прерван', sent: 'Отправлено', uncertain: 'Неизвестно', sending: 'Отправляется'},
    perDay: 'в день', perChannel: 'за канал', adLabel: 'Реклама',
  },
  en: {
    cabinet: 'My account', site: '← Back to site', logout: 'Sign out', signin: 'Sign in', signup: 'Sign up', email: 'Email', password: 'Password', name: 'Name',
    company: 'Company', iam: 'I am a', reader: 'Reader', advertiser: 'Advertiser', editor: 'Editor', admin: 'Administrator', submitSignin: 'Sign in', submitSignup: 'Create account',
    profile: 'Profile', bookmarks: 'Bookmarks', campaigns: 'Advertising', newsroom: 'Newsroom', moderation: 'Moderation', payments: 'Payments', users: 'Users', telegram: 'Telegram',
    save: 'Save', saved: 'Saved', language: 'Language', topics: 'My sections', channels: 'Telegram channels for your sections', channelSoon: 'channel coming soon', noBookmarks: 'No bookmarks yet. Save stories on the site.',
    newCampaign: 'New campaign', campaignName: 'Campaign name', placement: 'Placement', sections: 'Sections', languages: 'Audience languages', adTitle: 'Ad headline', adText: 'Ad text',
    clickUrl: 'Link (https://)', advertiserName: 'Advertiser shown in the label', erid: 'erid (ad registry token)', eridHint: 'Russian-language ads must be registered with an ad data operator (ОРД) and carry its erid token.',
    startDate: 'Start date', days: 'Days', total: 'Total', create: 'Save draft', submit: 'Submit for review', pay: 'Pay', edit: 'Edit', preview: 'Preview',
    status: 'Status', price: 'Price', impressions: 'Impressions', clicks: 'Clicks', ctr: 'CTR', noCampaigns: 'No campaigns yet.', becomeAdvertiser: 'Become an advertiser',
    becomeHint: 'Place ads in the feed, in articles and in ATLAS Telegram channels. Ads are reviewed before payment.',
    payWith: 'Payment method', invoice: 'Invoice', reference: 'Payment reference', openInvoice: 'Open payment page', approve: 'Approve', reject: 'Reject', note: 'Note',
    confirmPaid: 'Confirm payment', nothing: 'Nothing here.', runNow: 'Run agents now', runs: 'Agent runs', reviewQueue: 'Review queue', openReview: 'Open the queue on the site →',
    published: 'Published', held: 'Held', rejected: 'Rejected', errors: 'Errors', role: 'Role', channel: 'Channel', when: 'When',
    statuses: {draft: 'Draft', moderation: 'In review', awaiting_payment: 'Awaiting payment', scheduled: 'Paid, scheduled', active: 'Running', completed: 'Completed', rejected: 'Rejected', pending: 'Pending', paid: 'Paid', failed: 'Failed', partial: 'Partial', queued: 'Queued', running: 'Running', done: 'Done', interrupted: 'Interrupted', sent: 'Sent', uncertain: 'Unknown', sending: 'Sending'},
    perDay: 'per day', perChannel: 'per channel', adLabel: 'Ad',
  },
};
const tone = {active: 'ok', paid: 'ok', done: 'ok', sent: 'ok', completed: 'muted', scheduled: 'ok', moderation: 'warn', awaiting_payment: 'warn', pending: 'warn', queued: 'warn', running: 'warn', draft: 'muted', rejected: 'bad', failed: 'bad', uncertain: 'bad', interrupted: 'bad', partial: 'warn'};

const store = {get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }};
let lang = store.get('language') || (navigator.language.startsWith('ru') ? 'ru' : 'en');
const t = key => T[lang][key] ?? key;
const L = (ru, en) => (lang === 'ru' ? ru : en);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = (cents, currency = 'USD') => new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {style: 'currency', currency}).format(cents / 100);
const date = v => (v ? new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(v)) : '—');
const badge = s => `<span class="badge ${tone[s] || 'muted'}">${esc(T[lang].statuses[s] || s)}</span>`;

const realApi = async (path, {method = 'GET', body} = {}) => {
  const res = await fetch(path, {method, headers: body ? {'Content-Type': 'application/json'} : {}, body: body && JSON.stringify(body), credentials: 'same-origin'});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(Error(data.error || 'Request failed'), {status: res.status});
  return data;
};
const api = window.atlasDemoApi || realApi;
const siteBase = window.atlasDemoApi ? './' : '/';
const root = document.querySelector('#cabinet');
let state = {user: null, topics: [], packages: null, view: location.hash.slice(1) || 'profile'};

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('visible'), 3200);
}
const guard = fn => async event => {
  event?.preventDefault?.();
  const button = event?.submitter || event?.currentTarget;
  if (button?.tagName === 'BUTTON') button.disabled = true;
  try { await fn(event); } catch (e) { toast(e.message); } finally { if (button?.tagName === 'BUTTON') button.disabled = false; }
};

function views() {
  const role = state.user?.role;
  const list = [['profile', t('profile')], ['bookmarks', t('bookmarks')], ['campaigns', t('campaigns')]];
  if (role === 'editor' || role === 'admin') list.push(['newsroom', t('newsroom')]);
  if (role === 'admin') list.push(['moderation', t('moderation')], ['payments', t('payments')], ['users', t('users')], ['telegram', t('telegram')]);
  return list;
}

function frame(content) {
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = store.get('theme') || '';
  const demo = window.atlasDemoApi ? `<div class="demo-bar">${L('ДЕМО-РЕЖИМ на GitHub Pages: данные вымышлены и не сохраняются. Настоящий кабинет работает на сервере.', 'DEMO MODE on GitHub Pages: data is fictional and not saved. The real account area runs on the server.')}</div>` : '';
  root.innerHTML = `${demo}<div class="shell"><div class="top"><a class="wordmark" href="${siteBase}">atlas<span>●</span></a><span class="label">${t('cabinet')}</span>
  <div class="tools"><select id="lang" aria-label="Language"><option value="ru">RU</option><option value="en">EN</option></select><a href="${siteBase}">${t('site')}</a>${state.user ? `<button id="logout">${t('logout')}</button>` : ''}</div></div>${content}</div>`;
  const select = root.querySelector('#lang');
  select.value = lang;
  select.onchange = () => { lang = select.value; store.set('language', lang); render(); };
  const logout = root.querySelector('#logout');
  if (logout) logout.onclick = guard(async () => { await api('/api/auth/logout', {method: 'POST'}); state.user = null; render(); });
}

function authView(mode = 'signin') {
  frame(`<div class="auth card"><div class="tabs"><button data-mode="signin" aria-pressed="${mode === 'signin'}">${t('signin')}</button><button data-mode="signup" aria-pressed="${mode === 'signup'}">${t('signup')}</button></div>
  <form id="auth-form">
    ${mode === 'signup' ? `<label>${t('name')}<input name="name" autocomplete="name" maxlength="100"></label>` : ''}
    <label>${t('email')}<input name="email" type="email" autocomplete="email" required></label>
    <label>${t('password')}<input name="password" type="password" minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required>${mode === 'signup' ? `<small>${L('Не меньше 8 символов', 'At least 8 characters')}</small>` : ''}</label>
    ${mode === 'signup' ? `<label>${t('iam')}<select name="role"><option value="reader">${t('reader')}</option><option value="advertiser">${t('advertiser')}</option></select></label><label>${t('company')} <small>${L('для рекламодателей', 'for advertisers')}</small><input name="company" maxlength="150"></label>` : ''}
    ${window.atlasDemoApi ? `<p class="note">${L('Демо: вход с любым email и паролем открывает кабинет администратора.', 'Demo: any email and password opens the administrator view.')}</p>` : ''}<p class="error" id="auth-error" role="alert"></p>
    <button class="btn">${mode === 'signup' ? t('submitSignup') : t('submitSignin')}</button>
  </form></div>`);
  root.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => authView(b.dataset.mode)));
  root.querySelector('#auth-form').onsubmit = guard(async e => {
    const data = Object.fromEntries(new FormData(e.target));
    try {
      state.user = (await api(mode === 'signup' ? '/api/auth/register' : '/api/auth/login', {method: 'POST', body: data})).user;
      render();
    } catch (err) { root.querySelector('#auth-error').textContent = err.message; }
  });
}

const topicName = id => state.topics.find(x => x.id === id)?.name?.[lang] || id;

async function profileView() {
  const u = state.user;
  const sections = state.topics.filter(x => x.id !== 'main');
  const mine = sections.filter(x => !u.topics.length || u.topics.includes(x.id));
  return `<h1>${t('profile')}</h1><p class="lede">${esc(u.email)} · ${t(u.role)}</p>
  <form class="card" id="profile-form"><div class="row"><label>${t('name')}<input name="name" value="${esc(u.name)}" maxlength="100"></label><label>${t('company')}<input name="company" value="${esc(u.company)}" maxlength="150"></label>
  <label>${t('language')}<select name="language"><option value="ru" ${u.language === 'ru' ? 'selected' : ''}>Русский</option><option value="en" ${u.language === 'en' ? 'selected' : ''}>English</option></select></label></div>
  <p class="note">${t('topics')}</p><div class="checks">${sections.map(x => `<label><input type="checkbox" name="topics" value="${x.id}" ${u.topics.includes(x.id) ? 'checked' : ''}> ${esc(x.name[lang])}</label>`).join('')}</div>
  <button class="btn">${t('save')}</button></form>
  <h2>${t('channels')}</h2><div class="card">${[state.topics.find(x => x.id === 'main'), ...mine].filter(Boolean).map(x => {
    const link = x.telegram[lang];
    return `<div class="list-item"><span>${esc(x.name[lang])}</span>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace('https://t.me/', '@'))} ↗</a>` : `<span class="note">${esc(x.suggested[lang])} · ${t('channelSoon')}</span>`}</div>`;
  }).join('')}</div>
  ${u.role === 'reader' ? `<div class="card"><h2 style="margin-top:0">${t('becomeAdvertiser')}</h2><p class="note">${t('becomeHint')}</p><button class="btn ghost" id="become">${t('becomeAdvertiser')}</button></div>` : ''}`;
}
function bindProfile() {
  root.querySelector('#profile-form').onsubmit = guard(async e => {
    const f = new FormData(e.target);
    state.user = (await api('/api/me', {method: 'PATCH', body: {name: f.get('name'), company: f.get('company'), language: f.get('language'), topics: f.getAll('topics')}})).user;
    toast(t('saved'));
    render();
  });
  const become = root.querySelector('#become');
  if (become) become.onclick = guard(async () => { state.user = (await api('/api/me/advertiser', {method: 'POST'})).user; state.view = 'campaigns'; render(); });
}

async function bookmarksView() {
  const list = await api('/api/me/bookmarks');
  return `<h1>${t('bookmarks')}</h1><div class="card">${list.length ? list.map(a => `<div class="list-item"><a href="${siteBase}#article/${esc(a.id)}">${esc(a.title[lang])}</a><button class="btn ghost small" data-unsave="${esc(a.id)}">✕</button></div>`).join('') : `<p class="note">${t('noBookmarks')}</p>`}</div>`;
}
function bindBookmarks() {
  root.querySelectorAll('[data-unsave]').forEach(b => (b.onclick = guard(async () => { await api('/api/me/bookmarks/' + encodeURIComponent(b.dataset.unsave), {method: 'DELETE'}); render(); })));
}

function campaignForm(c = {}) {
  const p = state.packages, today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const sel = (list, v) => (c[list] || (list === 'languages' ? ['ru'] : [])).includes(v) ? 'checked' : '';
  return `<form class="card" id="campaign-form" data-id="${c.id || ''}"><h2 style="margin-top:0">${c.id ? t('edit') : t('newCampaign')}</h2>
  <div class="row"><label>${t('campaignName')}<input name="name" value="${esc(c.name)}" required maxlength="100"></label>
  <label>${t('placement')}<select name="placement">${Object.entries(p.placements).map(([id, x]) => `<option value="${id}" ${c.placement === id ? 'selected' : ''}>${esc(x.name[lang])} — ${money(x.priceCents, p.currency)} ${x.unit === 'day' ? t('perDay') : t('perChannel')}</option>`).join('')}</select></label></div>
  <p class="note" id="placement-hint"></p>
  <p class="note">${t('sections')}</p><div class="checks">${p.topics.map(id => `<label><input type="checkbox" name="topics" value="${id}" ${sel('topics', id)}> ${esc(topicName(id))}</label>`).join('')}</div>
  <p class="note">${t('languages')}</p><div class="checks">${['ru', 'en'].map(l => `<label><input type="checkbox" name="languages" value="${l}" ${sel('languages', l)}> ${l === 'ru' ? 'Русский' : 'English'}</label>`).join('')}</div>
  <label>${t('adTitle')} <small>≤ 90</small><input name="title" value="${esc(c.title)}" maxlength="90" required></label>
  <label>${t('adText')} <small>≤ 400</small><textarea name="text" maxlength="400" required>${esc(c.text)}</textarea></label>
  <div class="row"><label>${t('clickUrl')}<input name="clickUrl" type="url" value="${esc(c.clickUrl)}" placeholder="https://" required></label>
  <label>${t('advertiserName')}<input name="advertiserName" value="${esc(c.advertiserName || state.user.company)}" required maxlength="150"></label></div>
  <div class="row"><label>${t('erid')}<input name="erid" value="${esc(c.erid)}" maxlength="64" pattern="[A-Za-z0-9]*"><small>${t('eridHint')}</small></label>
  <label>${t('startDate')}<input name="startDate" type="date" value="${esc(c.startDate || today)}" min="${today}" required></label>
  <label id="days-field">${t('days')}<input name="days" type="number" min="${p.minDays}" max="${p.maxDays}" value="${c.days || 7}"></label></div>
  <div class="ad-preview" id="ad-preview"></div>
  <div class="actions" style="margin-top:16px"><span>${t('total')}: <b class="price" id="price">—</b></span><button class="btn" style="margin-left:auto">${t('create')}</button>${c.id ? `<button type="button" class="btn ghost" id="cancel-edit">✕</button>` : ''}</div></form>`;
}
function readCampaign(form) {
  const f = new FormData(form);
  return {name: f.get('name'), placement: f.get('placement'), topics: f.getAll('topics'), languages: f.getAll('languages'), title: f.get('title'), text: f.get('text'), clickUrl: f.get('clickUrl'), advertiserName: f.get('advertiserName'), erid: f.get('erid'), startDate: f.get('startDate'), days: Number(f.get('days'))};
}
function bindCampaignForm() {
  const form = root.querySelector('#campaign-form');
  if (!form) return;
  const p = state.packages;
  const update = () => {
    const c = readCampaign(form), pl = p.placements[c.placement];
    const cents = pl.unit === 'channel' ? pl.priceCents * c.topics.length * c.languages.length : pl.priceCents * (c.days || 0);
    form.querySelector('#price').textContent = money(cents, p.currency);
    form.querySelector('#days-field').hidden = pl.unit === 'channel';
    form.querySelector('#placement-hint').textContent = pl.description[lang];
    const label = [t('adLabel'), c.advertiserName, c.erid ? 'erid: ' + c.erid : ''].filter(Boolean).join(' · ');
    form.querySelector('#ad-preview').innerHTML = `<small>${t('preview')}</small><h3 style="margin:8px 0">${esc(c.title || '…')}</h3><p>${esc(c.text || '…')}</p><small>${esc(label)}</small>`;
  };
  form.oninput = update;
  update();
  form.onsubmit = guard(async () => {
    const id = form.dataset.id;
    await api(id ? '/api/campaigns/' + id : '/api/campaigns', {method: id ? 'PATCH' : 'POST', body: readCampaign(form)});
    toast(t('saved'));
    state.editing = null;
    render();
  });
  const cancel = form.querySelector('#cancel-edit');
  if (cancel) cancel.onclick = () => { state.editing = null; render(); };
}

async function campaignsView() {
  if (state.user.role === 'reader') return `<h1>${t('campaigns')}</h1><div class="card"><p class="note">${t('becomeHint')}</p><button class="btn" id="become">${t('becomeAdvertiser')}</button></div>`;
  state.packages ||= await api('/api/ads/packages');
  const [list, pays] = await Promise.all([api('/api/campaigns'), api('/api/payments')]);
  const totals = list.reduce((s, c) => ({impressions: s.impressions + c.impressions, clicks: s.clicks + c.clicks, spent: s.spent + (['scheduled', 'active', 'completed'].includes(c.status) ? c.priceCents : 0)}), {impressions: 0, clicks: 0, spent: 0});
  const editing = state.editing && list.find(c => c.id === state.editing);
  const providers = state.packages.providers;
  return `<h1>${t('campaigns')}</h1><p class="lede">${t('becomeHint')}</p>
  <div class="grid"><div class="card stat"><b>${totals.impressions.toLocaleString()}</b><span>${t('impressions')}</span></div><div class="card stat"><b>${totals.clicks.toLocaleString()}</b><span>${t('clicks')}</span></div>
  <div class="card stat"><b>${totals.impressions ? (totals.clicks / totals.impressions * 100).toFixed(1) + '%' : '—'}</b><span>${t('ctr')}</span></div><div class="card stat"><b>${money(totals.spent, state.packages.currency)}</b><span>${t('payments')}</span></div></div>
  ${campaignForm(editing || {})}
  <div class="card table-wrap"><table><thead><tr><th>${t('campaignName')}</th><th>${t('status')}</th><th class="num">${t('price')}</th><th class="num">${t('impressions')}</th><th class="num">${t('clicks')}</th><th></th></tr></thead><tbody>
  ${list.map(c => {
    const pay = pays.find(p => p.campaignId === c.id && p.status !== 'failed');
    let action = '';
    if (['draft', 'rejected'].includes(c.status)) action = `<button class="btn small" data-submit="${c.id}">${t('submit')}</button> <button class="btn ghost small" data-edit="${c.id}">${t('edit')}</button>`;
    if (c.status === 'awaiting_payment') action = pay ? payInfo(pay) : `<select data-provider="${c.id}" aria-label="${t('payWith')}">${providers.map(p => `<option value="${p.id}">${esc(p.name[lang])}</option>`).join('')}</select> <button class="btn small" data-pay="${c.id}">${t('pay')}</button>`;
    return `<tr><td><b>${esc(c.name)}</b><br><small class="note">${esc(state.packages.placements[c.placement]?.name[lang] || c.placement)} · ${c.topics.map(topicName).join(', ')} · ${c.languages.join('/').toUpperCase()}${c.startsAt ? ' · ' + date(c.startsAt) + ' — ' + date(c.endsAt) : ''}</small>${c.moderationNote ? `<br><small class="note">${t('note')}: ${esc(c.moderationNote)}</small>` : ''}</td>
      <td>${badge(c.status)}</td><td class="num">${money(c.priceCents, state.packages.currency)}</td><td class="num">${c.impressions}</td><td class="num">${c.clicks}</td><td>${action}</td></tr>`;
  }).join('') || `<tr><td colspan="6" class="note">${t('noCampaigns')}</td></tr>`}</tbody></table></div>`;
}
function payInfo(p) {
  if (p.invoiceUrl) return `${badge(p.status)} <a class="btn small" href="${esc(p.invoiceUrl)}" target="_blank" rel="noopener">${t('openInvoice')} ↗</a>`;
  return `${badge(p.status)}<p class="note">${t('reference')}: <b>${esc(p.details.reference)}</b><br>${esc(p.details.instructions)}</p>`;
}
function bindCampaigns() {
  const become = root.querySelector('#become');
  if (become) become.onclick = guard(async () => { state.user = (await api('/api/me/advertiser', {method: 'POST'})).user; render(); });
  bindCampaignForm();
  root.querySelectorAll('[data-submit]').forEach(b => (b.onclick = guard(async () => { await api(`/api/campaigns/${b.dataset.submit}/submit`, {method: 'POST'}); render(); })));
  root.querySelectorAll('[data-edit]').forEach(b => (b.onclick = () => { state.editing = Number(b.dataset.edit); render(); }));
  root.querySelectorAll('[data-pay]').forEach(b => (b.onclick = guard(async () => {
    const p = await api(`/api/campaigns/${b.dataset.pay}/pay`, {method: 'POST', body: {provider: root.querySelector(`[data-provider="${b.dataset.pay}"]`).value}});
    if (p.invoiceUrl) window.open(p.invoiceUrl, '_blank', 'noopener');
    render();
  })));
}

async function newsroomView() {
  const [jobs, queue] = await Promise.all([api('/api/newsroom/jobs'), api('/api/review')]);
  return `<h1>${t('newsroom')}</h1><p class="lede">${L('Агент поиска находит новости, второй агент независимо перепроверяет их минимум по двум источникам, третий пишет текст на русском и английском. Спорные материалы попадают в очередь проверки.', 'The search agent finds stories, a second agent independently verifies them against at least two sources, and a third writes Russian and English copy. Borderline stories go to the review queue.')}</p>
  <div class="actions"><button class="btn" id="run">${t('runNow')}</button><a class="btn ghost" href="${siteBase}#review">${t('reviewQueue')}: ${queue.length} · ${t('openReview')}</a></div>
  <h2>${t('runs')}</h2><div class="card table-wrap"><table><thead><tr><th>${t('when')}</th><th>${t('status')}</th><th class="num">${t('published')}</th><th class="num">${t('held')}</th><th class="num">${t('rejected')}</th><th class="num">${t('errors')}</th><th class="num">Tokens</th></tr></thead><tbody>
  ${jobs.map(j => { const r = j.result || {}; return `<tr><td>${date(j.created_at)}</td><td>${badge(j.status)}${r.error ? `<br><small class="note">${esc(r.error)}</small>` : ''}</td><td class="num">${r.published?.length ?? '—'}</td><td class="num">${r.held?.length ?? '—'}</td><td class="num">${r.rejected?.length ?? '—'}</td><td class="num">${r.errors?.length ?? '—'}</td><td class="num">${r.usage ? (r.usage.input_tokens + r.usage.output_tokens).toLocaleString() : '—'}</td></tr>`; }).join('') || `<tr><td colspan="7" class="note">${t('nothing')}</td></tr>`}
  </tbody></table></div>`;
}
function bindNewsroom() { root.querySelector('#run').onclick = guard(async () => { await api('/api/newsroom/run', {method: 'POST'}); toast(L('Запуск поставлен в очередь', 'Run queued')); render(); }); }

async function moderationView() {
  const list = await api('/api/admin/campaigns?status=moderation');
  state.packages ||= await api('/api/ads/packages');
  return `<h1>${t('moderation')}</h1><p class="lede">${L('Проверьте текст, ссылку и маркировку до оплаты.', 'Check the copy, link and ad label before payment.')}</p>
  ${list.map(c => `<div class="card"><div class="actions"><b>${esc(c.name)}</b> ${badge(c.status)} <span class="note">${esc(state.packages.placements[c.placement]?.name[lang])} · ${c.topics.map(topicName).join(', ')} · ${c.languages.join('/').toUpperCase()} · ${money(c.priceCents, state.packages.currency)}</span></div>
    <div class="ad-preview" style="margin:12px 0"><h3 style="margin:0 0 8px">${esc(c.title)}</h3><p>${esc(c.text)}</p><small>${t('adLabel')} · ${esc(c.advertiserName)}${c.erid ? ' · erid: ' + esc(c.erid) : ''}</small><p><a href="${esc(c.clickUrl)}" target="_blank" rel="noopener nofollow">${esc(c.clickUrl)} ↗</a></p></div>
    <label>${t('note')}<input data-note="${c.id}" maxlength="500"></label><div class="actions"><button class="btn small" data-moderate="${c.id}" data-decision="approve">${t('approve')}</button><button class="btn ghost small" data-moderate="${c.id}" data-decision="reject">${t('reject')}</button></div></div>`).join('') || `<div class="card note">${t('nothing')}</div>`}`;
}
function bindModeration() {
  root.querySelectorAll('[data-moderate]').forEach(b => (b.onclick = guard(async () => {
    await api(`/api/admin/campaigns/${b.dataset.moderate}/moderate`, {method: 'POST', body: {decision: b.dataset.decision, note: root.querySelector(`[data-note="${b.dataset.moderate}"]`).value}});
    render();
  })));
}

async function paymentsView() {
  const list = await api('/api/admin/payments');
  return `<h1>${t('payments')}</h1><p class="lede">${L('Счета с ручной оплатой подтверждайте только после поступления денег. Криптоплатежи подтверждаются автоматически.', 'Confirm manual invoices only after the money arrives. Crypto payments confirm automatically.')}</p>
  <div class="card table-wrap"><table><thead><tr><th>${t('when')}</th><th>${t('reference')}</th><th>${t('payWith')}</th><th class="num">${t('price')}</th><th>${t('status')}</th><th></th></tr></thead><tbody>
  ${list.map(p => `<tr><td>${date(p.createdAt)}</td><td><code>${esc(p.id)}</code><br><small class="note">#${p.campaignId}</small></td><td>${esc(p.provider)}</td><td class="num">${money(p.amountCents, p.currency)}</td><td>${badge(p.status)}</td><td>${p.provider === 'manual' && p.status === 'pending' ? `<button class="btn small" data-confirm="${esc(p.id)}">${t('confirmPaid')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="6" class="note">${t('nothing')}</td></tr>`}</tbody></table></div>`;
}
function bindPayments() {
  root.querySelectorAll('[data-confirm]').forEach(b => (b.onclick = guard(async () => {
    if (!confirm(L('Деньги действительно поступили?', 'Has the money actually arrived?'))) return;
    await api(`/api/admin/payments/${b.dataset.confirm}/confirm`, {method: 'POST'});
    render();
  })));
}

async function usersView() {
  const list = await api('/api/admin/users');
  return `<h1>${t('users')}</h1><div class="card table-wrap"><table><thead><tr><th>${t('email')}</th><th>${t('name')}</th><th>${t('role')}</th><th>${t('when')}</th></tr></thead><tbody>
  ${list.map(u => `<tr><td>${esc(u.email)}</td><td>${esc(u.name)}${u.company ? `<br><small class="note">${esc(u.company)}</small>` : ''}</td><td>${u.id === state.user.id ? t(u.role) : `<select data-role="${u.id}" aria-label="${t('role')}">${['reader', 'advertiser', 'editor', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${t(r)}</option>`).join('')}</select>`}</td><td>${date(u.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindUsers() { root.querySelectorAll('[data-role]').forEach(s => (s.onchange = guard(async () => { await api('/api/admin/users/' + s.dataset.role, {method: 'PATCH', body: {role: s.value}}); toast(t('saved')); }))); }

async function telegramView() {
  const posts = await api('/api/admin/telegram');
  return `<h1>${t('telegram')}</h1><h2>${t('channels')}</h2><div class="card">${state.topics.map(x => `<div class="list-item"><span>${esc(x.name[lang])}</span><span>${['ru', 'en'].map(l => x.telegram[l] ? `<a href="${esc(x.telegram[l])}" target="_blank" rel="noopener">${esc(x.telegram[l].replace('https://t.me/', '@'))}</a>` : `<span class="note">${esc(x.suggested[l])} — ${t('channelSoon')}</span>`).join(' · ')}</span></div>`).join('')}</div>
  <p class="note">${L('Проверить права бота и выставить названия каналов: TELEGRAM_BOT_TOKEN=… node tools/telegram-setup.js --apply --write-config', 'Check bot rights and sync channel titles: TELEGRAM_BOT_TOKEN=… node tools/telegram-setup.js --apply --write-config')}</p>
  <div class="card table-wrap"><table><thead><tr><th>${t('when')}</th><th>${t('channel')}</th><th>${t('status')}</th><th></th></tr></thead><tbody>${posts.map(p => `<tr><td>${date(p.attempted_at)}</td><td>${esc(p.channel.replace('https://t.me/', '@'))} · ${p.language.toUpperCase()}</td><td>${badge(p.status)}${p.error ? `<br><small class="note">${esc(p.error)}</small>` : ''}</td><td><small class="note">${esc(p.article_id || 'campaign #' + p.campaign_id)}</small></td></tr>`).join('') || `<tr><td colspan="4" class="note">${t('nothing')}</td></tr>`}</tbody></table></div>`;
}

const pages = {profile: [profileView, bindProfile], bookmarks: [bookmarksView, bindBookmarks], campaigns: [campaignsView, bindCampaigns], newsroom: [newsroomView, bindNewsroom], moderation: [moderationView, bindModeration], payments: [paymentsView, bindPayments], users: [usersView, bindUsers], telegram: [telegramView, () => {}]};

async function render() {
  if (!state.user) return authView();
  const available = views();
  if (!available.some(([id]) => id === state.view)) state.view = 'profile';
  const [view, bind] = pages[state.view];
  let content;
  try { content = await view(); } catch (e) { if (e.status === 401) { state.user = null; return authView(); } content = `<p class="error">${esc(e.message)}</p>`; }
  frame(`<div class="layout"><nav class="side" aria-label="${t('cabinet')}"><div class="who">${esc(state.user.name || state.user.email)}<br>${t(state.user.role)}</div>${available.map(([id, label]) => `<a href="#${id}" class="${id === state.view ? 'active' : ''}">${label}</a>`).join('')}</nav><main>${content}</main></div>`);
  bind();
}

window.addEventListener('hashchange', () => { state.view = location.hash.slice(1) || 'profile'; render(); });
(async () => {
  try { state.topics = (await api('/api/topics')).topics; } catch { state.topics = []; }
  try { state.user = (await api('/api/me')).user; } catch { state.user = null; }
  render();
})();
