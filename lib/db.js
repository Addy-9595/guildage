const { Pool } = require('pg');

let _pool = null;
let _initPromise = null;

function getPool() {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL || '';
  const isLocal = url.match(/localhost|127\.0\.0\.1/);
  const isPooler = url.includes('pooler.supabase.com');
  const sslConfig = isLocal ? false : { rejectUnauthorized: false };
  _pool = new Pool({
    connectionString: url,
    ssl: sslConfig,
    ...(isPooler && { keepAlive: false })
  });
  return _pool;
}

function initDb() {
  const pool = getPool();
  return pool.query(`
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
}

function accrueInterest() {
  const pool = getPool();
  const now = Math.floor(Date.now() / 1000);
  pool.query(
    `UPDATE agents
     SET token_balance = token_balance + (0.001 + task_count * 0.0005) * ($1 - last_accrual) / 60.0,
         last_accrual  = $1
     WHERE deposit_paid = 1 AND ($1 - last_accrual) >= 10`,
    [now]
  ).catch(err => console.error('accrual error:', err));
}

async function ensureReady() {
  if (!_initPromise) _initPromise = initDb();
  await _initPromise;
  accrueInterest();
  const pool = getPool();
  return { query: (sql, args) => pool.query(sql, args) };
}

module.exports = { ensureReady };
