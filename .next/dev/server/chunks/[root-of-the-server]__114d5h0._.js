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
"[project]/Desktop/Guildage/pages/api/borrow.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

const { ensureReady } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/db.js [api] (ecmascript)");
const { createInvoice, createL402Token, satsToTokens } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/lightning.js [api] (ecmascript)");
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { borrower_agent_id, skill_needed } = req.body;
    if (!borrower_agent_id || !skill_needed) return res.status(400).json({
        error: 'borrower_agent_id and skill_needed required'
    });
    const db = await ensureReady();
    const borRes = await db.execute({
        sql: 'SELECT * FROM agents WHERE id = ? AND deposit_paid = 1',
        args: [
            borrower_agent_id
        ]
    });
    const borrower = borRes.rows[0];
    if (!borrower) return res.status(404).json({
        error: 'Borrower agent not found'
    });
    const allRes = await db.execute({
        sql: 'SELECT * FROM agents WHERE deposit_paid = 1 AND id != ?',
        args: [
            borrower_agent_id
        ]
    });
    const provider = allRes.rows.find((a)=>JSON.parse(a.skills).some((s)=>s.toLowerCase().includes(skill_needed.toLowerCase())));
    if (!provider) return res.status(404).json({
        error: `No licensed agent found with skill: ${skill_needed}`
    });
    const balance = Number(provider.token_balance);
    const borrow_sats = balance < 500 ? 50 : balance < 2000 ? 100 : 200;
    const borrow_tokens = satsToTokens(borrow_sats);
    if (Number(borrower.token_balance) >= borrow_tokens) {
        await db.execute({
            sql: 'UPDATE agents SET token_balance = token_balance - ? WHERE id = ?',
            args: [
                borrow_tokens,
                borrower_agent_id
            ]
        });
        const borrow_id = generateId();
        await db.execute({
            sql: 'INSERT INTO borrows (id, borrower_agent_id, provider_agent_id, skill_requested, tokens_paid) VALUES (?,?,?,?,?)',
            args: [
                borrow_id,
                borrower_agent_id,
                provider.id,
                skill_needed,
                borrow_tokens
            ]
        });
        const l402 = await createL402Token({
            agent_id: provider.id,
            skill: skill_needed,
            duration_hours: 24
        });
        return res.status(200).json({
            borrow_id,
            payment_method: 'tokens',
            tokens_deducted: borrow_tokens,
            access_token: l402.access_token,
            provider: {
                id: provider.id,
                name: provider.name,
                skills: JSON.parse(provider.skills)
            },
            message: `Access granted. ${borrow_tokens} tokens deducted.`
        });
    }
    const invoice = await createInvoice({
        amount_sats: borrow_sats,
        memo: `Borrow ${skill_needed} from ${provider.name}`,
        agent_id: borrower_agent_id,
        type: 'borrow'
    });
    const borrow_id = generateId();
    await db.execute({
        sql: 'INSERT INTO invoices (id, agent_id, type, amount_sats, payment_hash) VALUES (?,?,?,?,?)',
        args: [
            invoice.invoice_id,
            borrower_agent_id,
            'borrow',
            borrow_sats,
            invoice.payment_hash
        ]
    });
    await db.execute({
        sql: 'INSERT INTO borrows (id, borrower_agent_id, provider_agent_id, skill_requested, tokens_paid, invoice_id) VALUES (?,?,?,?,0,?)',
        args: [
            borrow_id,
            borrower_agent_id,
            provider.id,
            skill_needed,
            invoice.invoice_id
        ]
    });
    return res.status(402).json({
        borrow_id,
        payment_method: 'lightning',
        payment_required: true,
        amount_sats: borrow_sats,
        invoice,
        provider: {
            id: provider.id,
            name: provider.name,
            skills: JSON.parse(provider.skills)
        },
        message: `Pay ${borrow_sats} sats via Lightning to borrow ${skill_needed} from ${provider.name}`
    });
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__114d5h0._.js.map