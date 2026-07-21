# ClauseFlow Bradbury Clean Deployment Notes

This version is clean-deployed on Bradbury. The real Mochi-Game payment path is verified and visible on the Dashboard; the separate Bradbury refund path still needs final smoke verification before submission.

## Target Network

- Network: GenLayer Testnet Bradbury
- Chain ID: `4221`
- Explorer: `https://explorer-bradbury.genlayer.com`
- Frontend config: `public/config.js`
- Current tested contract: `0xA851b0D3cD85f5Abc91E459C172bc326d5A41bdf`
- Deploy tx: `0x08b7d84fc341dbe035b00027eaa62acb7f56f97047e8350e870c955f5e1f3ad2`
- Deploy result: `ACCEPTED / AGREE / FINISHED_WITH_RETURN`
- Verified views: `get_offer_ids`, `get_deal_ids`, `get_dashboard_stats`
- Verified payment smoke: deal `1` reached `PAID`; dashboard totals show `completedDeals=1` and `totalPaidAtto=10000000000000000`.

## Preflight

Run these before deploy:

```powershell
npm run lint:contract
pytest tests/direct/ -v
npm test -- --run
npm run typecheck
npm run build
npm run test:e2e
npm run preflight:bradbury
```

`npm run preflight:bradbury` confirms `.env` key names, the derived deployer address, active GenLayer network, active account address, balance, and lock status without printing secret values. Unlock the active account before deploy if it reports `ACTIVE_ACCOUNT_STATUS=locked`.

## Deploy

```powershell
genlayer network testnet-bradbury
genlayer config get network
genlayer account
genlayer deploy --contract contracts/clauseflow.py
```

Only mark deployment verified after recording:

- deploy command
- deployer address
- deploy transaction hash
- lifecycle status
- execution result
- contract address
- schema output
- successful basic view call such as `get_deal_ids`

## Smoke Scenario

Use the real Mochi-Game evidence package:

- GitHub: `https://github.com/tanphung/Mochi-Game`
- Live app: `https://mochi-game-frontend.vercel.app`
- Docs: `https://github.com/tanphung/Mochi-Game#readme`
- Agreement title: `Audit and polish Mochi-Game Quest Evaluator demo flow`
- Test amount: below `0.5 GEN`

Smoke flow:

1. Builder structures clauses with AI drafting.
2. Builder publishes the reviewed offer.
3. Client accepts and locks exact GEN.
4. Builder submits Mochi-Game evidence URLs.
5. GenLayer reviews the evidence against accepted clauses.
6. Approved path claims and confirms payment.
7. Refund path is tested separately with rejected or unreachable evidence.
8. Dashboard shows completed contracts and paid/refunded totals from contract views.

## Safety

Private keys stay only in local `.env` and GenLayer keystore files. Frontend config must contain only public chain, explorer, and verified contract address values.
