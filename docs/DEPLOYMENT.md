# ClauseFlow Bradbury Deployment Proof

## Canonical Deployment

- Network: GenLayer Testnet Bradbury
- Chain ID: `4221`
- Contract: `0x90ef8Bc9f3AF76861Da8FeC0502aA045e697AAd3`
- Deployer: `0xe78def025cE53c9b46ac56cF19f720391119fa5b`
- EVM activation: `0xb70f4b8c06405e7ecff98e10e75d089ec38723bd2d500740f52a8931f8fd877b`
- GenLayer deployment: `0x5288569c15e0238ef8e037f01645cd2d3657604ead786370852c1f704d8b4e71`
- Result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Schema: 18 methods, 9 writes and 9 views
- Initial final view: `get_offer_ids=[]`
- Normalized source SHA-256: `32DFF0ED0C3E4A198412DF46CD2437F5651CD5BF10EDBB3BB5D8FD788D229718`

## Pilot Settlement Proof

Payment and refund transaction tables are populated only after every write has the expected lifecycle, consensus, execution result, refreshed deal state, and balance-backed settlement confirmation.

Expected terminal totals:

| Metric | Expected |
| --- | ---: |
| Offers | `2` |
| Deals | `2` |
| Completed | `2` |
| Funded | `0.035 GEN` |
| Paid | `0.02 GEN` |
| Refunded | `0.015 GEN` |
| Active/accounted escrow | `0 GEN` |
| Contract balance | `0 GEN` |

## Verification Commands

```powershell
npm audit --omit=dev
npm run lint:contract
py -3.13 -m pytest tests/direct -q
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run preflight:bradbury
genlayer code 0x90ef8Bc9f3AF76861Da8FeC0502aA045e697AAd3
genlayer schema 0x90ef8Bc9f3AF76861Da8FeC0502aA045e697AAd3
```

Private keys remain local in `.env` and are never included in this proof.
