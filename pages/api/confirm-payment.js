const { ensureReady } = require('../../lib/db');
const { checkPayment, satsToTokens } = require('../../lib/lightning');
const { syncAgentToArbiter } = require('../../lib/arbiter');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { agent_id, invoice_id } = req.body;
  if (!agent_id || !invoice_id) return res.status(400).json({ error: 'agent_id and invoice_id required' });
  const db = await ensureReady();
  const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1 AND agent_id = $2', [invoice_id, agent_id]);
  const invoice = rows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'paid') return res.status(400).json({ error: 'Already paid' });
  const payment = await checkPayment(invoice.payment_hash);
  if (!payment.paid) return res.status(402).json({ error: 'Payment not confirmed' });
  const starting_tokens = satsToTokens(Number(invoice.amount_sats));
  await db.query('UPDATE agents SET deposit_paid = 1, token_balance = $1, last_accrual = $2 WHERE id = $3',
    [starting_tokens, Math.floor(Date.now()/1000), agent_id]);
  await db.query("UPDATE invoices SET status = 'paid' WHERE id = $1", [invoice_id]);
  const { rows: agentRows } = await db.query('SELECT * FROM agents WHERE id = $1', [agent_id]);
  const agent = agentRows[0];
  const agentData = {
    id: agent_id,
    name: agent.name,
    owner_name: agent.owner_name,
    skills: JSON.parse(agent.skills),
    token_balance: agent.token_balance,
    deposit_sats: agent.deposit_sats,
  };
  syncAgentToArbiter(agentData); // fire and forget — no await
  return res.status(200).json({ success: true, agent: { ...agent, skills: JSON.parse(agent.skills) }, tokens_granted: starting_tokens, message: `Agent ${agent.name} is now active with ${starting_tokens} tokens!` });
}
