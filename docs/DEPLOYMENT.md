# ClauseFlow Bradbury Deployment Proof

## Canonical Deployment

- Network: GenLayer Testnet Bradbury
- Chain ID: `4221`
- Contract: `0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D`
- Deployer: `0xe78def025cE53c9b46ac56cF19f720391119fa5b`
- EVM activation: `0x7609207c201506536393adbb406a4c4f1388501b297c0439ae7b44cd60d7be31`
- GenLayer deployment: `0x3e2ad3fd2f4c980dc5d481d253e072b501a0508206a3f6c91245e2dc538e5737`
- Result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Schema: 18 methods, 9 writes and 9 views
- Initial final view: `get_offer_ids=[]`
- Normalized source SHA-256: `9897F34BD7674DF876CBBEF1E2D024564C1E43AA58E8405CE54CE237F7121187`

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
genlayer code 0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D
genlayer schema 0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D
```

Private keys remain local in `.env` and are never included in this proof.
