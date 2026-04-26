const { ensureReady } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const db = await ensureReady();
  const [{ rows: swaps }, { rows: borrows }] = await Promise.all([
    db.query(`SELECT s.*, a1.name as requester_name, a1.owner_name as requester_owner, a2.name as provider_name, a2.owner_name as provider_owner FROM swaps s JOIN agents a1 ON s.requester_agent_id = a1.id JOIN agents a2 ON s.provider_agent_id = a2.id ORDER BY s.created_at DESC LIMIT 20`),
    db.query(`SELECT b.*, a1.name as borrower_name, a1.owner_name as borrower_owner, a2.name as provider_name, a2.owner_name as provider_owner FROM borrows b JOIN agents a1 ON b.borrower_agent_id = a1.id JOIN agents a2 ON b.provider_agent_id = a2.id ORDER BY b.created_at DESC LIMIT 20`)
  ]);
  return res.status(200).json({ swaps, borrows });
}
