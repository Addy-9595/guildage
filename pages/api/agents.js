const { ensureReady } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const db = await ensureReady();
  const { rows } = await db.query('SELECT * FROM agents WHERE deposit_paid = 1 ORDER BY token_balance DESC');
  return res.status(200).json({
    agents: rows.map(a => ({
      ...a,
      skills: JSON.parse(a.skills),
      token_balance: Math.round(Number(a.token_balance) * 100) / 100,
      task_count: Number(a.task_count)
    }))
  });
}
