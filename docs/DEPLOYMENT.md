# ClauseFlow Bradbury Clean Deployment Notes

The final source was clean-deployed on Bradbury on 2026-07-22. Its schema, canonical views, payment path, refund path, and zero remaining escrow balance are verified.

## Target Network

- Network: GenLayer Testnet Bradbury
- Chain ID: `4221`
- Explorer: `https://explorer-bradbury.genlayer.com`
- Frontend config: `public/config.js`
- Final candidate contract: `0x993D37D07e31d8e3853B8702919f4d805299B124`
- Deploy activation tx: `0x6cc64c3d775401a0d57b0225f480d7b52dea34efdf13933c8753afd09e90c478`
- Deploy GenLayer tx: `0xeb762c3f00ebf8cc518e1c2a394b57f18b1d17cad0be4b61ad833a7b77f23d02`
- Deploy result: `ACCEPTED / AGREE / FINISHED_WITH_RETURN`
- Verified schema: 18 methods
- Verified clean view: `get_offer_ids=[]`
- Payment deal: `1`, `PAID`, `0.02 GEN`
- Payment claim tx: `0xda2dac1efbf088119b7088fbd698626ec9634d9e8f8b19ebb13187351f0682b7`
- Payment confirmation tx: `0x8286ae6293cb60c59a90ee80f3ada87de69bbd4a747155a28d6b13e32e38f5b7`
- Refund deal: `2`, `REFUNDED`, `0.015 GEN`
- Refund review tx: `0x53e8f2894cd74696df30af351d6c8d0a004a3a8a00b35ef347b6eb0ac6df3453`
- Refund claim tx: `0xcf6c8b5615924a70bd899ce09f81975d1571cada3779d067606652b35dffc1a7`
- Refund confirmation tx: `0xfda4b3b10ec345aec82205d986ca3eb5e75fc4ba56acca54b6b282e54d3c23e1`
- Final dashboard totals: 2 offers, 2 deals, 2 completed, `0.02 GEN` paid, `0.015 GEN` refunded
- Final contract balance and accounted escrow: `0 GEN`
- Production alias: `https://clauseflow-two.vercel.app`

The previous integration contract `0xA851b0D3cD85f5Abc91E459C172bc326d5A41bdf` is retained only as development history. The frontend and submission materials use the final contract above.

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
