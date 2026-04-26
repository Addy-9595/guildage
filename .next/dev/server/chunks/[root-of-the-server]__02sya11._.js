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
"[project]/Desktop/Guildage/pages/api/swap.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

const { ensureReady } = __turbopack_context__.r("[project]/Desktop/Guildage/lib/db.js [api] (ecmascript)");
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { requester_agent_id, skill_needed } = req.body;
    if (!requester_agent_id || !skill_needed) return res.status(400).json({
        error: 'requester_agent_id and skill_needed required'
    });
    const db = await ensureReady();
    const reqRes = await db.execute({
        sql: 'SELECT * FROM agents WHERE id = ? AND deposit_paid = 1',
        args: [
            requester_agent_id
        ]
    });
    const requester = reqRes.rows[0];
    if (!requester) return res.status(404).json({
        error: 'Requester agent not found'
    });
    const allRes = await db.execute({
        sql: 'SELECT * FROM agents WHERE deposit_paid = 1 AND id != ?',
        args: [
            requester_agent_id
        ]
    });
    const provider = allRes.rows.find((a)=>JSON.parse(a.skills).some((s)=>s.toLowerCase().includes(skill_needed.toLowerCase())));
    if (!provider) return res.status(404).json({
        error: `No licensed agent found with skill: ${skill_needed}`,
        available_skills: [
            ...new Set(allRes.rows.flatMap((a)=>JSON.parse(a.skills)))
        ]
    });
    const swap_id = generateId();
    await db.execute({
        sql: 'INSERT INTO swaps (id, requester_agent_id, provider_agent_id, skill_requested) VALUES (?,?,?,?)',
        args: [
            swap_id,
            requester_agent_id,
            provider.id,
            skill_needed
        ]
    });
    return res.status(200).json({
        swap_id,
        success: true,
        cost: 'FREE',
        provider: {
            id: provider.id,
            name: provider.name,
            owner_name: provider.owner_name,
            skills: JSON.parse(provider.skills)
        },
        requester_obligation: `${requester.name} must now serve ${provider.owner_name} in return`,
        message: `Swap active! ${provider.name} will assist you. In return, ${requester.name} must serve ${provider.owner_name}.`
    });
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__02sya11._.js.map