// Payment records for ad campaigns. Providers:
//   manual       - an invoice with the owner's payment instructions; an admin confirms receipt in the cabinet
//   nowpayments  - crypto invoice with automatic confirmation via signed webhook
import {randomBytes} from 'node:crypto';
import {nowIso} from '../db.js';
import * as nowpayments from './nowpayments.js';

const fail = (message, status = 400) => { throw Object.assign(Error(message), {status}); };
const row = p => p && ({id: p.id, campaignId: p.campaign_id, userId: p.user_id, provider: p.provider, amountCents: p.amount_cents, currency: p.currency, status: p.status, invoiceUrl: p.invoice_url, details: JSON.parse(p.details), createdAt: p.created_at, paidAt: p.paid_at});

export function availableProviders() {
  return [
    {id: 'manual', name: {ru: 'Счёт (оплата вручную)', en: 'Invoice (manual payment)'}},
    ...(nowpayments.nowpaymentsConfigured() ? [{id: 'nowpayments', name: {ru: 'Криптовалюта (USDT, BTC, ETH и др.)', en: 'Cryptocurrency (USDT, BTC, ETH and more)'}}] : []),
  ];
}

export function paymentService(db, {campaigns, publicUrl, currency = 'USD', fetcher = fetch}) {
  const get = id => row(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
  const confirm = (id, by) => {
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!p) fail('Not found', 404);
    if (p.status === 'paid') return row(p);
    db.prepare("UPDATE payments SET status = 'paid', paid_at = ?, details = json_set(details, '$.confirmedBy', ?) WHERE id = ?").run(nowIso(), by, id);
    campaigns.markPaid(p.campaign_id);
    return get(id);
  };
  return {
    get,
    listForUser(userId) { return db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(row); },
    listAll() { return db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 500').all().map(row); },
    async start(userId, campaignId, provider) {
      const campaign = campaigns.get(campaignId);
      if (!campaign || campaign.userId !== userId) fail('Not found', 404);
      if (campaign.status !== 'awaiting_payment') fail('This campaign is not awaiting payment', 409);
      if (!availableProviders().some(p => p.id === provider)) fail('This payment method is not available');
      // Reuse an open invoice instead of creating duplicates.
      const open = db.prepare("SELECT * FROM payments WHERE campaign_id = ? AND provider = ? AND status = 'pending'").get(campaignId, provider);
      if (open) return row(open);
      const id = 'pay_' + randomBytes(12).toString('hex');
      const payment = {id, amount_cents: campaign.priceCents, currency};
      let externalId = null, invoiceUrl = null, details = {};
      if (provider === 'nowpayments') ({externalId, invoiceUrl} = await nowpayments.createInvoice({payment, campaign, publicUrl, fetcher}));
      else details = {reference: id, instructions: process.env.ATLAS_MANUAL_PAYMENT_INSTRUCTIONS || 'The editorial team will send payment details to your email. Quote the reference in the payment.'};
      db.prepare("INSERT INTO payments (id, campaign_id, user_id, provider, amount_cents, currency, status, external_id, invoice_url, details, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)")
        .run(id, campaignId, userId, provider, campaign.priceCents, currency, externalId, invoiceUrl, JSON.stringify(details), nowIso());
      return get(id);
    },
    confirmManually(id, adminId) { return confirm(id, 'admin:' + adminId); },
    handleNowpaymentsIpn(body, signature) {
      if (!nowpayments.verifyIpn(body, signature)) fail('Invalid signature', 401);
      const p = db.prepare("SELECT * FROM payments WHERE id = ? AND provider = 'nowpayments'").get(String(body.order_id || ''));
      if (!p) fail('Unknown order', 404);
      const outcome = nowpayments.ipnOutcome(body);
      if (outcome === 'paid') {
        // The amount and currency must match what we invoiced.
        if (Math.round(Number(body.price_amount) * 100) !== p.amount_cents || String(body.price_currency).toUpperCase() !== p.currency) fail('Amount mismatch', 422);
        return confirm(p.id, 'nowpayments:' + body.payment_id);
      }
      if (p.status === 'pending' && (outcome === 'failed' || outcome === 'partial')) db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(outcome === 'failed' ? 'failed' : 'partial', p.id);
      return get(p.id);
    },
  };
}
