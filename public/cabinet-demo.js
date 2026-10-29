// In-memory stand-in for the backend, used only by the static GitHub Pages build of the cabinet.
// Nothing leaves the browser; reloading the page resets everything.
(() => {
  const now = Date.now(), day = 86400000, iso = t => new Date(t).toISOString();
  const packages = window.atlasDemoPackages;
  const topics = window.atlasDemoTopics;
  const articles = window.atlasDemoArticles || [];
  let user = null, nextId = 4;
  const fail = (message, status = 400) => { throw Object.assign(Error(message), {status}); };
  const users = [
    {id: 1, email: 'owner@atlas.example', name: 'Редакция ATLAS', company: 'ATLAS', role: 'admin', language: 'ru', topics: [], createdAt: iso(now - 30 * day)},
    {id: 2, email: 'ads@coffee.example', name: 'Мария', company: 'Coffee Lab', role: 'advertiser', language: 'ru', topics: [], createdAt: iso(now - 8 * day)},
    {id: 3, email: 'reader@example.com', name: 'Reader', company: '', role: 'reader', language: 'en', topics: ['science'], createdAt: iso(now - 2 * day)},
  ];
  const base = {userId: 1, languages: ['ru'], erid: '2SDnjdemo1', moderationNote: '', createdAt: iso(now - 5 * day), updatedAt: iso(now - day)};
  const campaigns = [
    {...base, id: 1, name: 'Осенний запуск', placement: 'feed', topics: ['technology', 'science'], title: 'Ноутбук для исследователей', text: 'Лёгкий, тихий и с батареей на весь день. Скидка 10% читателям ATLAS.', clickUrl: 'https://example.com/laptop', advertiserName: 'ООО «Пример»', startDate: iso(now - 3 * day).slice(0, 10), days: 14, priceCents: 21000, status: 'active', startsAt: iso(now - 3 * day), endsAt: iso(now + 11 * day), impressions: 12840, clicks: 214},
    {...base, id: 2, name: 'Telegram-анонс', placement: 'telegram', topics: ['economy'], languages: ['ru', 'en'], title: 'Курс по финансовой грамотности', text: 'Шесть коротких уроков о бюджете и инвестициях.', clickUrl: 'https://example.com/course', advertiserName: 'Example School', startDate: iso(now + 2 * day).slice(0, 10), days: 1, priceCents: 6000, status: 'awaiting_payment', impressions: 0, clicks: 0},
    {...base, id: 3, userId: 2, name: 'Кофе для редакций', placement: 'article', topics: ['culture'], title: 'Свежая обжарка каждую неделю', text: 'Подписка на кофе с доставкой в офис.', clickUrl: 'https://coffee.example', advertiserName: 'Coffee Lab', erid: '', startDate: iso(now + day).slice(0, 10), days: 7, priceCents: 7000, status: 'moderation', impressions: 0, clicks: 0},
  ];
  const payments = [{id: 'pay_demo01', campaignId: 1, userId: 1, provider: 'nowpayments', amountCents: 21000, currency: 'USD', status: 'paid', invoiceUrl: null, details: {}, createdAt: iso(now - 4 * day), paidAt: iso(now - 4 * day)}];
  const jobs = [
    {id: 2, kind: 'newsroom', status: 'done', created_at: iso(now - 3600000), result: {published: [1, 2, 3], held: [1], rejected: [1, 2], errors: [], usage: {input_tokens: 182400, output_tokens: 21300}}},
    {id: 1, kind: 'newsroom', status: 'done', created_at: iso(now - 2 * 3600000), result: {published: [1, 2], held: [], rejected: [1], errors: [], usage: {input_tokens: 150210, output_tokens: 17800}}},
  ];
  const bookmarks = new Set(articles.slice(0, 2).map(a => a.id));
  const price = c => { const p = packages.placements[c.placement]; return p.unit === 'channel' ? p.priceCents * c.topics.length * c.languages.length : p.priceCents * c.days; };
  const own = id => campaigns.find(c => c.id === Number(id) && (c.userId === user.id || user.role === 'admin')) || fail('Not found', 404);
  const need = (...roles) => { if (!user) fail('Please sign in', 401); if (roles.length && !roles.includes(user.role)) fail('Not allowed for your account', 403); };
  const validate = b => {
    if (!b.name || !b.title || !b.text || !b.advertiserName) fail('Fill in all required fields');
    if (!/^https:\/\//.test(b.clickUrl || '')) fail('Link must be an https:// address');
    if (!b.topics?.length || !b.languages?.length) fail('Choose sections and languages');
    const c = {...b, days: packages.placements[b.placement].unit === 'channel' ? 1 : Number(b.days)};
    return {...c, priceCents: price(c)};
  };

  window.atlasDemoApi = async (path, {method = 'GET', body} = {}) => {
    await new Promise(r => setTimeout(r, 120));
    const [p, query] = path.split('?');
    const m = (verb, pattern) => method === verb && p.match(new RegExp('^' + pattern + '$'));
    let r;
    if (m('GET', '/api/topics')) return {topics};
    if (m('GET', '/api/me')) { need(); return {user}; }
    if (m('POST', '/api/auth/login')) { user = users[0]; return {user}; }
    if (m('POST', '/api/auth/register')) { user = {id: 9, email: body.email, name: body.name || '', company: body.company || '', role: body.role === 'advertiser' ? 'advertiser' : 'reader', language: 'ru', topics: [], createdAt: iso(Date.now())}; users.unshift(user); return {user}; }
    if (m('POST', '/api/auth/logout')) { user = null; return {ok: true}; }
    if (m('PATCH', '/api/me')) { need(); Object.assign(user, {name: body.name, company: body.company, language: body.language, topics: body.topics}); return {user}; }
    if (m('POST', '/api/me/advertiser')) { need(); if (user.role === 'reader') user.role = 'advertiser'; return {user}; }
    if (m('GET', '/api/me/bookmarks')) { need(); return articles.filter(a => bookmarks.has(a.id)); }
    if ((r = m('DELETE', '/api/me/bookmarks/(.+)'))) { bookmarks.delete(decodeURIComponent(r[1])); return {ok: true}; }
    if (m('GET', '/api/ads/packages')) return {...packages, providers: [{id: 'manual', name: {ru: 'Счёт (оплата вручную)', en: 'Invoice (manual payment)'}}, {id: 'nowpayments', name: {ru: 'Криптовалюта (USDT, BTC, ETH и др.)', en: 'Cryptocurrency (USDT, BTC, ETH and more)'}}], topics: topics.filter(t => t.id !== 'main').map(t => t.id)};
    if (m('GET', '/api/campaigns')) { need('advertiser', 'admin'); return campaigns.filter(c => c.userId === user.id); }
    if (m('POST', '/api/campaigns')) { need('advertiser', 'admin'); const c = {...validate(body), id: nextId++, userId: user.id, status: 'draft', impressions: 0, clicks: 0, moderationNote: '', createdAt: iso(Date.now())}; campaigns.unshift(c); return c; }
    if ((r = m('PATCH', '/api/campaigns/(\\d+)'))) { const c = own(r[1]); Object.assign(c, validate({...c, ...body}), {status: 'draft'}); return c; }
    if ((r = m('POST', '/api/campaigns/(\\d+)/submit'))) { const c = own(r[1]); c.status = 'moderation'; return c; }
    if ((r = m('POST', '/api/campaigns/(\\d+)/pay'))) {
      const c = own(r[1]);
      const pay = {id: 'pay_demo' + nextId++, campaignId: c.id, userId: user.id, provider: body.provider, amountCents: c.priceCents, currency: 'USD', status: 'pending', invoiceUrl: null, details: body.provider === 'manual' ? {reference: 'pay_demo' + nextId, instructions: 'Демо: здесь будут реквизиты для оплаты (кошелёк USDT или банковский счёт), указанные владельцем сайта.'} : {}, createdAt: iso(Date.now())};
      if (body.provider === 'nowpayments') { pay.status = 'paid'; c.status = 'scheduled'; c.startsAt = iso(Date.parse(c.startDate)); c.endsAt = iso(Date.parse(c.startDate) + c.days * day); }
      payments.unshift(pay);
      return pay;
    }
    if (m('GET', '/api/payments')) { need(); return payments.filter(x => x.userId === user.id); }
    if (m('GET', '/api/newsroom/jobs')) { need('editor', 'admin'); return jobs; }
    if (m('GET', '/api/review')) { need('editor', 'admin'); return []; }
    if (m('POST', '/api/newsroom/run')) { need('editor', 'admin'); jobs.unshift({id: jobs.length + 1, kind: 'newsroom', status: 'queued', created_at: iso(Date.now()), result: null}); return {ok: true}; }
    if (m('GET', '/api/admin/campaigns')) { need('admin'); const status = new URLSearchParams(query).get('status'); return campaigns.filter(c => !status || c.status === status); }
    if ((r = m('POST', '/api/admin/campaigns/(\\d+)/moderate'))) { const c = own(r[1]); c.status = body.decision === 'approve' ? 'awaiting_payment' : 'rejected'; c.moderationNote = body.note || ''; return c; }
    if (m('GET', '/api/admin/payments')) { need('admin'); return payments; }
    if ((r = m('POST', '/api/admin/payments/(.+)/confirm'))) { const pay = payments.find(x => x.id === r[1]); pay.status = 'paid'; const c = campaigns.find(x => x.id === pay.campaignId); c.status = 'scheduled'; c.startsAt = iso(Date.parse(c.startDate)); c.endsAt = iso(Date.parse(c.startDate) + c.days * day); return pay; }
    if (m('GET', '/api/admin/users')) { need('admin'); return users; }
    if ((r = m('PATCH', '/api/admin/users/(\\d+)'))) { const u = users.find(x => x.id === Number(r[1])); u.role = body.role; return u; }
    if (m('GET', '/api/admin/telegram')) { need('admin'); return []; }
    fail('Not available in the demo', 404);
  };
})();
