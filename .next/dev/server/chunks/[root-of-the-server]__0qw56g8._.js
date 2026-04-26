module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/Desktop/Guildage/lib/db.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

const { createClient } = __turbopack_context__.r("[externals]/@libsql/client [external] (@libsql/client, cjs, [project]/Desktop/Guildage/node_modules/@libsql/client)");
const path = __turbopack_context__.r("[externals]/path [external] (path, cjs)");
let _db = null;
let schemaReady = false;
function getDb() {
    if (_db) return _db;
    _db = createClient({
        url: `file:${path.join(process.cwd(), 'agentbank.db')}`
    });
    return _db;
}
async function initSchema(db) {
    await db.executeMultiple(`
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
      created_at INTEGER DEFAULT (strftime('%s','now')),
      last_accrual INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      type TEXT NOT NULL,
      amount_sats INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_hash TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS swaps (
      id TEXT PRIMARY KEY,
      requester_agent_id TEXT NOT NULL,
      provider_agent_id TEXT NOT NULL,
      skill_requested TEXT NOT NULL,
      requester_obligation_done INTEGER DEFAULT 0,
      provider_obligation_done INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS borrows (
      id TEXT PRIMARY KEY,
      borrower_agent_id TEXT NOT NULL,
      provider_agent_id TEXT NOT NULL,
      skill_requested TEXT NOT NULL,
      tokens_paid REAL NOT NULL,
      invoice_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      description TEXT NOT NULL,
      tokens_earned REAL DEFAULT 0,
      completed_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
}
async function accrueInterest(db) {
    const now = Math.floor(Date.now() / 1000);
    const result = await db.execute('SELECT * FROM agents WHERE deposit_paid = 1');
    for (const agent of result.rows){
        const elapsed = now - Number(agent.last_accrual);
        if (elapsed < 10) continue;
        const mins = elapsed / 60;
        const earned = (0.001 + Number(agent.task_count) * 0.0005) * mins;
        await db.execute({
            sql: 'UPDATE agents SET token_balance = token_balance + ?, last_accrual = ? WHERE id = ?',
            args: [
                earned,
                now,
                agent.id
            ]
        });
    }
}
async function ensureReady() {
    const db = getDb();
    if (!schemaReady) {
        await initSchema(db);
        schemaReady = true;
    }
    await accrueInterest(db);
    return db;
}
module.exports = {
    getDb,
    ensureReady,
    accrueInterest
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
"[project]/Desktop/Guildage/pages/api/register.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

const { ensureReady } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/db.js [api] (ecmascript)");
const { createInvoice, satsToTokens } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/lightning.js [api] (ecmascript)");
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { name, owner_name, skills, api_key, model_endpoint } = req.body;
    if (!name || !owner_name || !skills?.length) return res.status(400).json({
        error: 'name, owner_name, and skills required'
    });
    const db = await ensureReady();
    // Add columns if not exist
    try {
        await db.execute("ALTER TABLE agents ADD COLUMN api_key TEXT");
        await db.execute("ALTER TABLE agents ADD COLUMN model_endpoint TEXT");
    } catch (e) {}
    const agent_id = generateId();
    const owner_id = generateId();
    const invoice = await createInvoice({
        amount_sats: 100,
        memo: `Registration: ${name}`,
        agent_id,
        type: 'registration'
    });
    await db.execute({
        sql: 'INSERT INTO agents (id, name, owner_name, owner_id, skills, deposit_sats, deposit_paid, token_balance, api_key, model_endpoint) VALUES (?,?,?,?,?,?,0,0,?,?)',
        args: [
            agent_id,
            name,
            owner_name,
            owner_id,
            JSON.stringify(skills),
            100,
            api_key || null,
            model_endpoint || null
        ]
    });
    await db.execute({
        sql: 'INSERT INTO invoices (id, agent_id, type, amount_sats, payment_hash) VALUES (?,?,?,?,?)',
        args: [
            invoice.invoice_id,
            agent_id,
            'registration',
            100,
            invoice.payment_hash
        ]
    });
    return res.status(200).json({
        agent_id,
        owner_id,
        invoice,
        deposit_sats: 100,
        starting_tokens: satsToTokens(100),
        message: `Pay 100 sats to activate`
    });
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0qw56g8._.js.map