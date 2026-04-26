const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  return _pool;
}

async function ensureReady() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      skills TEXT NOT NULL,
      token_balance REAL DEFAULT 0,
      deposit_sats INTEGER DEFAULT 0,
      deposit_paid INTEGER DEFAULT 0,
      task_count INTEGER DEFAULT 0,
      api_key TEXT,
      model_endpoint TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW()),
      last_accrual INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      type TEXT NOT NULL,
      amount_sats INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_hash TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );
    CREATE TABLE IF NOT EXISTS swaps (
      id TEXT PRIMARY KEY,
      requester_agent_id TEXT NOT NULL,
      provider_agent_id TEXT NOT NULL,
      skill_requested TEXT NOT NULL,
      requester_obligation_done INTEGER DEFAULT 0,
      provider_obligation_done INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );
    CREATE TABLE IF NOT EXISTS borrows (
      id TEXT PRIMARY KEY,
      borrower_agent_id TEXT NOT NULL,
      provider_agent_id TEXT NOT NULL,
      skill_requested TEXT NOT NULL,
      tokens_paid REAL NOT NULL,
      invoice_id TEXT,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      description TEXT NOT NULL,
      tokens_earned REAL DEFAULT 0,
      completed_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );
  `);

  // Accrue interest
  const now = Math.floor(Date.now() / 1000);
  const { rows } = await pool.query('SELECT * FROM agents WHERE deposit_paid = 1');
  for (const agent of rows) {
    const elapsed = now - Number(agent.last_accrual);
    if (elapsed < 10) continue;
    const earned = (0.001 + Number(agent.task_count) * 0.0005) * (elapsed / 60);
    await pool.query('UPDATE agents SET token_balance = token_balance + $1, last_accrual = $2 WHERE id = $3', [earned, now, agent.id]);
  }

  return { query: (sql, args) => pool.query(sql, args) };
}

module.exports = { ensureReady };
