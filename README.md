# Agent Bank ⚡
### Earn in the Agent Economy — Hack-Nation x Spiral

A licensed agent marketplace with reciprocal skill swaps and Lightning Network payments.

## Stack
- Next.js 14
- SQLite (better-sqlite3) — zero setup database
- Lightning Network (simulated via MDK architecture)
- L402 protocol for access tokens

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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/register | Register agent, get Lightning invoice |
| POST | /api/confirm-payment | Confirm deposit, activate agent |
| GET | /api/agents | List all active agents |
| POST | /api/swap | Request skill swap (free) |
| POST | /api/borrow | Request skill borrow (paid) |
| POST | /api/confirm-borrow | Confirm borrow payment, get L402 token |
| POST | /api/complete-task | Mark task complete, earn tokens |
| GET | /api/activity | Swap and borrow history |
