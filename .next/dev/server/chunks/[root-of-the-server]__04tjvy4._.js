module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/Desktop/Guildage/lib/db.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

const { Pool } = __turbopack_context__.r("[externals]/pg [external] (pg, cjs, [project]/Desktop/Guildage/node_modules/pg)");
let _pool = null;
function getPool() {
    if (_pool) return _pool;
    _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
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
    for (const agent of rows){
        const elapsed = now - Number(agent.last_accrual);
        if (elapsed < 10) continue;
        const earned = (0.001 + Number(agent.task_count) * 0.0005) * (elapsed / 60);
        await pool.query('UPDATE agents SET token_balance = token_balance + $1, last_accrual = $2 WHERE id = $3', [
            earned,
            now,
            agent.id
        ]);
    }
    return {
        query: (sql, args)=>pool.query(sql, args)
    };
}
module.exports = {
    ensureReady
};
}),
"[project]/Desktop/Guildage/lib/lightning.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
async function createInvoice({ amount_sats, memo, agent_id, type }) {
    const payment_hash = `lnbc${amount_sats}u1p${generateId()}`;
    const invoice_id = generateId();
    return {
        invoice_id,
        payment_hash,
        amount_sats,
        memo,
        bolt11: `lnbc${amount_sats}n1p${generateId()}xqyjw5qcqpjsp5`,
        expires_at: Date.now() + 3600000,
        demo_mode: true
    };
}
async function checkPayment(payment_hash) {
    return {
        paid: true,
        settled_at: Date.now(),
        amount_sats: 0
    };
}
async function createL402Token({ agent_id, skill, duration_hours }) {
    const token = Buffer.from(JSON.stringify({
        agent_id,
        skill,
        expires: Date.now() + duration_hours * 3600000,
        issued: Date.now()
    })).toString('base64');
    return {
        access_token: token,
        type: 'L402'
    };
}
function satsToTokens(sats) {
    return sats * 10;
}
module.exports = {
    createInvoice,
    checkPayment,
    createL402Token,
    satsToTokens
};
}),
"[project]/Desktop/Guildage/pages/api/confirm-borrow.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

const { ensureReady } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/db.js [api] (ecmascript)");
const { checkPayment, createL402Token, satsToTokens } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/lightning.js [api] (ecmascript)");
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { borrow_id, invoice_id } = req.body;
    if (!borrow_id || !invoice_id) return res.status(400).json({
        error: 'borrow_id and invoice_id required'
    });
    const db = await ensureReady();
    const { rows: invRows } = await db.query('SELECT * FROM invoices WHERE id = $1', [
        invoice_id
    ]);
    const invoice = invRows[0];
    if (!invoice) return res.status(404).json({
        error: 'Invoice not found'
    });
    const payment = await checkPayment(invoice.payment_hash);
    if (!payment.paid) return res.status(402).json({
        error: 'Payment not confirmed'
    });
    const { rows: borRows } = await db.query('SELECT * FROM borrows WHERE id = $1', [
        borrow_id
    ]);
    const borrow = borRows[0];
    const { rows: provRows } = await db.query('SELECT * FROM agents WHERE id = $1', [
        borrow.provider_agent_id
    ]);
    const provider = provRows[0];
    await db.query("UPDATE invoices SET status = 'paid' WHERE id = $1", [
        invoice_id
    ]);
    const tokens_paid = satsToTokens(Number(invoice.amount_sats));
    await db.query('UPDATE borrows SET tokens_paid = $1 WHERE id = $2', [
        tokens_paid,
        borrow_id
    ]);
    const l402 = await createL402Token({
        agent_id: provider.id,
        skill: borrow.skill_requested,
        duration_hours: 24
    });
    return res.status(200).json({
        success: true,
        access_token: l402.access_token,
        skill: borrow.skill_requested,
        provider_name: provider.name,
        provider,
        sats_paid: Number(invoice.amount_sats),
        valid_hours: 24,
        message: `Lightning payment confirmed. Access granted to ${borrow.skill_requested}.`
    });
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__04tjvy4._.js.map