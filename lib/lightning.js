const ALBY_API = 'https://api.getalby.com';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.ALBY_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function createInvoice({ amount_sats, memo }) {
  const res = await fetch(`${ALBY_API}/invoices`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ amount: amount_sats, memo }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Alby createInvoice failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return {
    invoice_id: data.payment_hash,
    payment_hash: data.payment_hash,
    bolt11: data.payment_request,
    amount_sats,
    memo,
    expires_at: new Date(data.expires_at).getTime(),
  };
}

async function checkPayment(payment_hash) {
  const res = await fetch(`${ALBY_API}/invoices/${payment_hash}`, {
    headers: headers(),
  });
  if (!res.ok) return { paid: false };
  const data = await res.json();
  return {
    paid: data.settled === true,
    settled_at: data.settled_at ? new Date(data.settled_at).getTime() : null,
    amount_sats: data.amount,
  };
}

async function createL402Token({ agent_id, skill, duration_hours }) {
  const payload = {
    agent_id,
    skill,
    expires: Date.now() + duration_hours * 3600000,
    issued: Date.now(),
  };
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  return { access_token: token, type: 'L402' };
}

function satsToTokens(sats) { return sats * 10; }

module.exports = { createInvoice, checkPayment, createL402Token, satsToTokens };
