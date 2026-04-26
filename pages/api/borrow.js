const { ensureReady } = require('../../lib/db');
const { createInvoice, createL402Token, satsToTokens } = require('../../lib/lightning');

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { borrower_agent_id, skill_needed } = req.body;
  if (!borrower_agent_id || !skill_needed) return res.status(400).json({ error: 'borrower_agent_id and skill_needed required' });
  const db = await ensureReady();
  const { rows: borRows } = await db.query('SELECT * FROM agents WHERE id = $1 AND deposit_paid = 1', [borrower_agent_id]);
  const borrower = borRows[0];
  if (!borrower) return res.status(404).json({ error: 'Borrower agent not found' });
  const { rows: allRows } = await db.query('SELECT * FROM agents WHERE deposit_paid = 1 AND id != $1', [borrower_agent_id]);
  const provider = allRows.find(a => JSON.parse(a.skills).some(s => s.toLowerCase().includes(skill_needed.toLowerCase())));
  if (!provider) return res.status(404).json({ error: `No licensed agent found with skill: ${skill_needed}` });
  const balance = Number(provider.token_balance);
  const borrow_sats = balance < 500 ? 50 : balance < 2000 ? 100 : 200;
  const borrow_tokens = satsToTokens(borrow_sats);
  if (Number(borrower.token_balance) >= borrow_tokens) {
    await db.query('UPDATE agents SET token_balance = token_balance - $1 WHERE id = $2', [borrow_tokens, borrower_agent_id]);
    const borrow_id = generateId();
    await db.query('INSERT INTO borrows (id, borrower_agent_id, provider_agent_id, skill_requested, tokens_paid) VALUES ($1,$2,$3,$4,$5)',
      [borrow_id, borrower_agent_id, provider.id, skill_needed, borrow_tokens]);
    const l402 = await createL402Token({ agent_id: provider.id, skill: skill_needed, duration_hours: 24 });
    return res.status(200).json({ borrow_id, payment_method: 'tokens', tokens_deducted: borrow_tokens, access_token: l402.access_token,
      provider: { id: provider.id, name: provider.name, skills: JSON.parse(provider.skills), api_key: provider.api_key, model_endpoint: provider.model_endpoint },
      message: `Access granted. ${borrow_tokens} tokens deducted.` });
  }
  const invoice = await createInvoice({ amount_sats: borrow_sats, memo: `Borrow ${skill_needed} from ${provider.name}`, agent_id: borrower_agent_id, type: 'borrow' });
  const borrow_id = generateId();
  await db.query('INSERT INTO invoices (id, agent_id, type, amount_sats, payment_hash) VALUES ($1,$2,$3,$4,$5)',
    [invoice.invoice_id, borrower_agent_id, 'borrow', borrow_sats, invoice.payment_hash]);
  await db.query('INSERT INTO borrows (id, borrower_agent_id, provider_agent_id, skill_requested, tokens_paid, invoice_id) VALUES ($1,$2,$3,$4,0,$5)',
    [borrow_id, borrower_agent_id, provider.id, skill_needed, invoice.invoice_id]);
  return res.status(402).json({ borrow_id, payment_method: 'lightning', payment_required: true, amount_sats: borrow_sats, invoice,
    provider: { id: provider.id, name: provider.name, skills: JSON.parse(provider.skills) },
    message: `Pay ${borrow_sats} sats via Lightning` });
}
