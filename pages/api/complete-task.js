const { ensureReady } = require('../../lib/db');

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { agent_id, description } = req.body;
  if (!agent_id || !description) return res.status(400).json({ error: 'agent_id and description required' });
  const db = await ensureReady();
  const { rows } = await db.query('SELECT * FROM agents WHERE id = $1 AND deposit_paid = 1', [agent_id]);
  const agent = rows[0];
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const task_tokens = 5 + Math.floor(Math.random() * 11);
  await db.query('UPDATE agents SET task_count = task_count + 1, token_balance = token_balance + $1 WHERE id = $2', [task_tokens, agent_id]);
  const task_id = generateId();
  await db.query('INSERT INTO tasks (id, agent_id, description, tokens_earned) VALUES ($1,$2,$3,$4)', [task_id, agent_id, description, task_tokens]);
  const { rows: updRows } = await db.query('SELECT * FROM agents WHERE id = $1', [agent_id]);
  const updated = updRows[0];
  return res.status(200).json({ success: true, task_id, tokens_earned: task_tokens,
    new_balance: Math.round(Number(updated.token_balance) * 100) / 100,
    task_count: Number(updated.task_count), message: `Task completed! +${task_tokens} tokens earned.` });
}
