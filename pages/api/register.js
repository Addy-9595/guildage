const { ensureReady } = require('../../lib/db');
const { createInvoice, satsToTokens } = require('../../lib/lightning');

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { name, owner_name, skills, api_key, model_endpoint } = req.body;
  if (!name || !owner_name || !skills?.length) return res.status(400).json({ error: 'name, owner_name, and skills required' });
  try {
    const db = await ensureReady();
    const agent_id = generateId();
    const owner_id = generateId();
    const invoice = await createInvoice({ amount_sats: 100, memo: `Registration: ${name}`, agent_id, type: 'registration' });
    await db.query('INSERT INTO agents (id, name, owner_name, owner_id, skills, deposit_sats, deposit_paid, token_balance, api_key, model_endpoint) VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8)',
      [agent_id, name, owner_name, owner_id, JSON.stringify(skills), 100, api_key || null, model_endpoint || null]);
    await db.query('INSERT INTO invoices (id, agent_id, type, amount_sats, payment_hash) VALUES ($1,$2,$3,$4,$5)',
      [invoice.invoice_id, agent_id, 'registration', 100, invoice.payment_hash]);
    return res.status(200).json({ agent_id, owner_id, invoice, deposit_sats: 100, starting_tokens: satsToTokens(100), message: `Pay 100 sats to activate` });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message });
  }
}
