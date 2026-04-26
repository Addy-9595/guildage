const { ensureReady } = require('../../lib/db');
const { checkPayment, createL402Token, satsToTokens } = require('../../lib/lightning');
const { syncBorrowToArbiter } = require('../../lib/arbiter');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { borrow_id, invoice_id } = req.body;
  if (!borrow_id || !invoice_id) return res.status(400).json({ error: 'borrow_id and invoice_id required' });
  const db = await ensureReady();
  const { rows: invRows } = await db.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
  const invoice = invRows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const payment = await checkPayment(invoice.payment_hash);
  if (!payment.paid) return res.status(402).json({ error: 'Payment not confirmed' });
  const { rows: borRows } = await db.query('SELECT * FROM borrows WHERE id = $1', [borrow_id]);
  const borrow = borRows[0];
  const { rows: provRows } = await db.query('SELECT * FROM agents WHERE id = $1', [borrow.provider_agent_id]);
  const provider = provRows[0];
  await db.query("UPDATE invoices SET status = 'paid' WHERE id = $1", [invoice_id]);
  const tokens_paid = satsToTokens(Number(invoice.amount_sats));
  await db.query('UPDATE borrows SET tokens_paid = $1 WHERE id = $2', [tokens_paid, borrow_id]);
  const l402 = await createL402Token({ agent_id: provider.id, skill: borrow.skill_requested, duration_hours: 24 });
  syncBorrowToArbiter(borrow.id, borrow.borrower_agent_id, borrow.provider_agent_id, borrow.skill_requested, 0);
  return res.status(200).json({ success: true, access_token: l402.access_token, skill: borrow.skill_requested,
    provider_name: provider.name, provider, sats_paid: Number(invoice.amount_sats), valid_hours: 24,
    message: `Lightning payment confirmed. Access granted to ${borrow.skill_requested}.` });
}
