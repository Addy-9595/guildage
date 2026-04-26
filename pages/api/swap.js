const { ensureReady } = require('../../lib/db');
const { syncSwapToArbiter } = require('../../lib/arbiter');

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { requester_agent_id, skill_needed } = req.body;
  if (!requester_agent_id || !skill_needed) return res.status(400).json({ error: 'requester_agent_id and skill_needed required' });
  const db = await ensureReady();
  const { rows: reqRows } = await db.query('SELECT * FROM agents WHERE id = $1 AND deposit_paid = 1', [requester_agent_id]);
  const requester = reqRows[0];
  if (!requester) return res.status(404).json({ error: 'Requester agent not found' });
  const { rows: allRows } = await db.query('SELECT * FROM agents WHERE deposit_paid = 1 AND id != $1', [requester_agent_id]);
  const provider = allRows.find(a => JSON.parse(a.skills).some(s => s.toLowerCase().includes(skill_needed.toLowerCase())));
  if (!provider) return res.status(404).json({ error: `No licensed agent found with skill: ${skill_needed}` });
  const swap_id = generateId();
  await db.query('INSERT INTO swaps (id, requester_agent_id, provider_agent_id, skill_requested) VALUES ($1,$2,$3,$4)',
    [swap_id, requester_agent_id, provider.id, skill_needed]);
  syncSwapToArbiter(swap_id, requester_agent_id, provider.id, skill_needed);
  return res.status(200).json({ swap_id, success: true, cost: 'FREE', arbiter_enabled: true,
    provider: { id: provider.id, name: provider.name, owner_name: provider.owner_name, skills: JSON.parse(provider.skills), api_key: provider.api_key, model_endpoint: provider.model_endpoint },
    requester_obligation: `${requester.name} must now serve ${provider.owner_name} in return`,
    message: `Swap active!` });
}
