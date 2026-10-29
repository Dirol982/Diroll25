import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {openDatabase, nowIso} from '../src/db.js';
import {authService} from '../src/auth.js';
import {campaignService, priceFor} from '../src/ads.js';
import {paymentService} from '../src/payments/index.js';
import {verifyIpn} from '../src/payments/nowpayments.js';

const packages = {currency: 'USD', minDays: 1, maxDays: 90, placements: {feed: {unit: 'day', priceCents: 1500}, telegram: {unit: 'channel', priceCents: 3000}}};
const topicIds = ['technology', 'science'];
const draft = {name: 'Launch', placement: 'feed', topics: ['technology'], languages: ['ru', 'en'], title: 'New laptop', text: 'Try it', clickUrl: 'https://shop.example/x', advertiserName: 'Shop LLC', erid: 'abc123', startDate: '2026-11-01', days: 3};

async function start(dir) {
  const child = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', 'server.js'], {cwd: new URL('..', import.meta.url), env: {...process.env, PORT: '0', ATLAS_DATA_DIR: dir, ATLAS_ADMIN_EMAIL: 'owner@example.com', ATLAS_PUBLIC_URL: ''}, stdio: ['ignore', 'pipe', 'pipe']});
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Startup timed out')); }, 10000);
    child.once('exit', code => reject(Error('Exit ' + code)));
    child.stdout.on('data', chunk => { const m = chunk.toString().match(/port (\d+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
  });
  return {child, base: 'http://127.0.0.1:' + port};
}

test('accounts, roles, campaign moderation, manual payment and ad serving over HTTP', {timeout: 30000}, async () => {
  const dir = await mkdtemp(tmpdir() + '/atlas-server-');
  const {child, base} = await start(dir);
  try {
    const session = () => {
      let cookie = '';
      return async (path, {method = 'GET', body, headers = {}} = {}) => {
        const res = await fetch(base + path, {method, headers: {'Content-Type': 'application/json', ...(cookie ? {Cookie: cookie} : {}), ...headers}, body: body && JSON.stringify(body)});
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return {status: res.status, data: await res.json().catch(() => null)};
      };
    };
    const owner = session(), seller = session(), anon = session();
    assert.equal((await owner('/api/auth/register', {method: 'POST', body: {email: 'owner@example.com', password: 'correct horse 1'}})).data.user.role, 'admin');
    assert.equal((await seller('/api/auth/register', {method: 'POST', body: {email: 'ads@shop.example', password: 'short'}})).status, 400);
    assert.equal((await seller('/api/auth/register', {method: 'POST', body: {email: 'ads@shop.example', password: 'long enough 1', role: 'advertiser'}})).data.user.role, 'advertiser');
    assert.equal((await anon('/api/auth/register', {method: 'POST', body: {email: 'x@y.example', password: 'long enough 1', role: 'admin'}})).status, 400);
    assert.equal((await anon('/api/auth/login', {method: 'POST', body: {email: 'ads@shop.example', password: 'wrong password'}})).status, 401);

    // Role gates and CSRF
    assert.equal((await anon('/api/review')).status, 401);
    assert.equal((await seller('/api/review')).status, 403);
    assert.equal((await owner('/api/review')).status, 200);
    assert.equal((await seller('/api/campaigns', {method: 'POST', body: draft, headers: {Origin: 'https://evil.example'}})).status, 403);

    // Campaign: draft -> moderation -> approved -> paid (manual) -> scheduled
    const created = await seller('/api/campaigns', {method: 'POST', body: {...draft, clickUrl: 'http://insecure.example'}});
    assert.equal(created.status, 400);
    const c = (await seller('/api/campaigns', {method: 'POST', body: draft})).data;
    assert.equal(c.priceCents, 4500);
    assert.equal((await seller(`/api/campaigns/${c.id}/pay`, {method: 'POST', body: {provider: 'manual'}})).status, 409);
    assert.equal((await seller(`/api/campaigns/${c.id}/submit`, {method: 'POST'})).data.status, 'moderation');
    assert.equal((await seller(`/api/admin/campaigns/${c.id}/moderate`, {method: 'POST', body: {decision: 'approve'}})).status, 403);
    assert.equal((await owner(`/api/admin/campaigns/${c.id}/moderate`, {method: 'POST', body: {decision: 'approve'}})).data.status, 'awaiting_payment');
    const pay = (await seller(`/api/campaigns/${c.id}/pay`, {method: 'POST', body: {provider: 'manual'}})).data;
    assert.equal(pay.status, 'pending');
    assert.equal((await seller(`/api/campaigns/${c.id}/pay`, {method: 'POST', body: {provider: 'nowpayments'}})).status, 400);
    assert.equal((await owner(`/api/admin/payments/${pay.id}/confirm`, {method: 'POST'})).data.status, 'paid');
    const after = (await seller('/api/campaigns')).data[0];
    assert.equal(after.status, 'scheduled');
    assert.ok(Date.parse(after.endsAt) - Date.parse(after.startsAt) === 3 * 86400000);

    // Bookmarks, profile and public endpoints
    const list = (await anon('/api/articles')).data;
    assert.ok(Array.isArray(list));
    if (list[0]) {
      assert.equal((await seller(`/api/me/bookmarks/${list[0].id}`, {method: 'PUT'})).status, 200);
      assert.equal((await seller('/api/me/bookmarks')).data.length, 1);
    }
    assert.deepEqual((await seller('/api/me', {method: 'PATCH', body: {topics: ['science', 'bogus'], language: 'en'}})).data.user.topics, ['science']);
    assert.equal((await anon('/api/ads?placement=feed&topic=technology&lang=ru')).data.ad, null);
    assert.equal((await anon('/api/config')).data.editorEnabled, false);
    assert.equal((await owner('/api/config')).data.editorEnabled, true);
    assert.equal((await seller('/api/auth/logout', {method: 'POST'})).status, 200);
    assert.equal((await seller('/api/me')).status, 401);
  } finally { child.kill(); await rm(dir, {recursive: true, force: true}); }
});

test('campaign scheduling, ad rotation and crypto payment webhook', async () => {
  const prev = {...process.env};
  process.env.NOWPAYMENTS_API_KEY = 'test-key';
  process.env.NOWPAYMENTS_IPN_SECRET = 'test-secret';
  try {
    const db = openDatabase(':memory:');
    const user = authService(db).register({email: 'a@b.example', password: 'long enough 1', role: 'advertiser'});
    const campaigns = campaignService(db, {packages, topicIds});
    let invoiceRequest;
    const payments = paymentService(db, {campaigns, publicUrl: 'https://atlas.example', fetcher: async (url, init) => { invoiceRequest = JSON.parse(init.body); return {ok: true, json: async () => ({id: 99, invoice_url: 'https://nowpayments.io/payment/?iid=99'})}; }});
    const c = campaigns.create(user.id, {...draft, startDate: '2026-01-01'});
    campaigns.submit(user.id, c.id);
    campaigns.moderate(c.id, 'approve');
    const p = await payments.start(user.id, c.id, 'nowpayments');
    assert.equal(invoiceRequest.price_amount, 45);
    assert.equal(invoiceRequest.ipn_callback_url, 'https://atlas.example/api/payments/nowpayments/ipn');
    assert.equal((await payments.start(user.id, c.id, 'nowpayments')).id, p.id);

    const ipn = {payment_id: 5, payment_status: 'finished', order_id: p.id, price_amount: 45, price_currency: 'usd', pay_currency: 'usdttrc20'};
    const sign = body => createHmac('sha512', 'test-secret').update(JSON.stringify(Object.fromEntries(Object.keys(body).sort().map(k => [k, body[k]])))).digest('hex');
    assert.ok(verifyIpn(ipn, sign(ipn)));
    assert.throws(() => payments.handleNowpaymentsIpn({...ipn, price_amount: 1}, sign({...ipn, price_amount: 1})), {status: 422});
    assert.throws(() => payments.handleNowpaymentsIpn(ipn, sign({...ipn, payment_status: 'waiting'})), {status: 401});
    assert.equal(payments.handleNowpaymentsIpn(ipn, sign(ipn)).status, 'paid');
    assert.equal(campaigns.get(c.id).status, 'scheduled');

    const started = campaigns.tick(new Date());
    assert.equal(started[0].status, 'active');
    assert.equal(campaigns.pickAd({placement: 'feed', topic: 'technology', language: 'ru'}).id, c.id);
    assert.equal(campaigns.pickAd({placement: 'feed', topic: 'science', language: 'ru'}), null);
    assert.equal(campaigns.click(c.id), 'https://shop.example/x');
    assert.equal(campaigns.get(c.id).impressions, 1);
    campaigns.tick(new Date(Date.now() + 10 * 86400000));
    assert.equal(campaigns.get(c.id).status, 'completed');
    assert.equal(priceFor(packages, {placement: 'telegram', days: 1, topics: ['technology', 'science'], languages: ['ru']}), 6000);
    assert.ok(nowIso());
  } finally { process.env = prev; }
});
