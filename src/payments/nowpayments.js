// NOWPayments crypto invoices (https://nowpayments.io). The advertiser pays on the provider's
// hosted page; the provider calls our IPN webhook, signed with HMAC-SHA512 over the sorted JSON body.
import {createHmac, timingSafeEqual} from 'node:crypto';

const API = 'https://api.nowpayments.io/v1';

export const nowpaymentsConfigured = () => !!(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);

export async function createInvoice({payment, campaign, publicUrl, fetcher = fetch}) {
  const response = await fetcher(API + '/invoice', {
    method: 'POST',
    headers: {'x-api-key': process.env.NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      price_amount: payment.amount_cents / 100,
      price_currency: payment.currency.toLowerCase(),
      order_id: payment.id,
      order_description: `ATLAS ad campaign #${campaign.id}: ${campaign.name}`.slice(0, 200),
      ipn_callback_url: new URL('/api/payments/nowpayments/ipn', publicUrl).href,
      success_url: new URL('/cabinet#campaigns', publicUrl).href,
      cancel_url: new URL('/cabinet#campaigns', publicUrl).href,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.invoice_url) throw Object.assign(Error('Payment provider could not create an invoice'), {status: 502});
  return {externalId: String(body.id), invoiceUrl: body.invoice_url};
}

const sortKeys = value => Array.isArray(value) ? value.map(sortKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sortKeys(value[k])])) : value;

export function verifyIpn(body, signature, secret = process.env.NOWPAYMENTS_IPN_SECRET) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac('sha512', secret).update(JSON.stringify(sortKeys(body))).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
}

// Only "finished" means the full amount arrived. Partial payments are left for the admin to resolve.
export function ipnOutcome(body) {
  if (body.payment_status === 'finished') return 'paid';
  if (['failed', 'expired', 'refunded'].includes(body.payment_status)) return 'failed';
  if (body.payment_status === 'partially_paid') return 'partial';
  return 'pending';
}
