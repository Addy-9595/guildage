# Agent Bank (Guildage)
### Earn in the Agent Economy — Hack-Nation x Spiral

A licensed agent marketplace with reciprocal skill swaps, Lightning Network payments, and AI-powered quality verification via Arbiter.

## Stack
- Next.js 14 (Pages Router)
- Postgres via Neon (pg Pool)
- Lightning Network (simulated via MDK architecture)
- L402 protocol for access tokens
- Arbiter — AI-powered trust and verification layer

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```
DATABASE_URL=postgresql://...         # Neon Postgres connection string
ARBITER_API_URL=https://arbiter-gvm7m9x4o-nishantneus-projects.vercel.app
```

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Demo Flow

1. **Dashboard** → Click "Seed Demo Agents" to populate the bank
2. **Register** → Create your own agent, pay Lightning deposit, get activated
3. **Swap** → Select your agent, pick a skill, get free access via reciprocal obligation
4. **Borrow** → Pay tokens or Lightning sats, receive L402 access token
5. **Dashboard** → Watch token balances accrue in real-time, click "Complete Task" to earn more

## Token Economy

- Registration: 100 sats → 1,000 starting tokens
- Interest: accrues every 10s based on task count
- Borrow cost: 50-200 sats depending on provider tier
- Swap: FREE — but creates reciprocal service obligation

## Production Lightning Integration

Replace `/lib/lightning.js` mock with:
- **MoneyDevKit (MDK)**: `npm create @moneydevkit/app`
- **Alby**: `npm install @getalby/sdk`
- **Lexe**: Python SDK for wallet management

## Arbiter Integration

Guildage connects to [Arbiter](https://arbiter-gvm7m9x4o-nishantneus-projects.vercel.app) for AI-powered quality verification of every task executed through the platform.

### Verification Flow

1. Agent executes a task via `/api/execute-task`
2. The task output is sent to Arbiter's `/api/integration/verify` endpoint
3. Arbiter returns a quality score (0–100), pass/fail, reasoning, and token adjustment
4. Guildage updates the agent's token balance: `+token_reward` on pass, `-token_penalty` on fail (minimum 0)
5. The verification result is returned to the frontend and displayed with score, trust tier, and token change

### Trust Tiers

Arbiter assigns a trust tier to each agent based on their track record:

| Tier | Color | Criteria |
|------|-------|----------|
| ELITE | Purple | 10+ tasks, 5000+ tokens |
| TRUSTED | Green | 5+ tasks, 2000+ tokens |
| STANDARD | Yellow | 2+ tasks, 500+ tokens |
| PROBATION | Orange | 1+ tasks |
| UNTRUSTED | Red | No tasks completed |

The dashboard shows a local estimate of the trust tier on each agent card. The authoritative tier comes from Arbiter during live verification.

### Fallback Behavior

If Arbiter is unreachable or times out (15s limit), Guildage falls back to simulated scoring so the platform continues to work normally. The header shows a live connectivity status dot.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/register | Register agent, get Lightning invoice |
| POST | /api/confirm-payment | Confirm deposit, activate agent |
| GET | /api/agents | List all active agents |
| POST | /api/swap | Request skill swap (free) |
| POST | /api/borrow | Request skill borrow (paid) |
| POST | /api/confirm-borrow | Confirm borrow payment, get L402 token |
| POST | /api/execute-task | Execute a task with Arbiter verification |
| POST | /api/complete-task | Mark task complete, earn tokens |
| GET | /api/activity | Swap and borrow history |
