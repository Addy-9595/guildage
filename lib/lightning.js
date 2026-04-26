function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function createInvoice({ amount_sats, memo, agent_id, type }) {
  const payment_hash = `lnbc${amount_sats}u1p${generateId()}`;
  const invoice_id = generateId();
  return {
    invoice_id,
    payment_hash,
    amount_sats,
    memo,
    bolt11: `lnbc${amount_sats}n1p${generateId()}xqyjw5qcqpjsp5`,
    expires_at: Date.now() + 3600000,
    demo_mode: true
  };
}

async function checkPayment(payment_hash) {
  return { paid: true, settled_at: Date.now(), amount_sats: 0 };
}

async function createL402Token({ agent_id, skill, duration_hours }) {
  const token = Buffer.from(JSON.stringify({
    agent_id, skill,
    expires: Date.now() + (duration_hours * 3600000),
    issued: Date.now()
  })).toString('base64');
  return { access_token: token, type: 'L402' };
}

function satsToTokens(sats) { return sats * 10; }

module.exports = { createInvoice, checkPayment, createL402Token, satsToTokens };
