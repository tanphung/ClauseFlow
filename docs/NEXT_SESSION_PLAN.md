# ClauseFlow Next Session Plan

Use this checklist when the user says: `Lam theo ke hoach tiep theo`.

## Safety Boundary

- Create, edit, or delete files only inside `D:\app genlayer\ClauseFlow`.
- Files outside that directory are read-only reference material.
- Never print or commit `.env` values, private keys, passwords, or seed phrases.
- Keep every test agreement below `0.5 GEN`.

## Verified Public State

- Repository: `https://github.com/tanphung/ClauseFlow`
- Production frontend: `https://clauseflow-two.vercel.app`
- Final Bradbury contract: `0x993D37D07e31d8e3853B8702919f4d805299B124`
- Verified payment: deal `1`, `PAID`, `0.02 GEN`
- Verified refund: deal `2`, `REFUNDED`, `0.015 GEN`
- Dashboard totals: 2 offers, 2 deals, 2 completed, `0.02 GEN` paid, `0.015 GEN` refunded
- Contract balance and accounted escrow: `0 GEN`
- Production frontend: `https://clauseflow-two.vercel.app`, verified against the final contract

## Completed Release Gate

1. Full local gate passed: audit, component tests, typecheck, build, GenVM lint, direct contract tests, and desktop/mobile E2E.
2. Vercel production points to the final Bradbury contract.
3. Production QA passed for Dashboard, filters, Offers, Create, Deal Detail, accepted clauses, evidence review, history, links, loading/error states, and responsive layout.
4. The README production screenshot shows the final paid and refunded histories.
5. Final source and release checkpoints are pushed to `main`.

## Final Submission Gate

ClauseFlow satisfies this gate. Record the demo video from production and submit the full repository, live app, contract explorer, and reviewer notes together.
