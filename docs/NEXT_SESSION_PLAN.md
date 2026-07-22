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
- Production frontend: pending promotion to the final contract at the start of this checklist update

## Remaining Order

1. Run the full local gate: npm audit, component tests, typecheck, build, GenVM lint, direct contract tests, and desktop/mobile E2E.
2. Deploy the frontend with `public/config.js` pointing to the final contract.
3. Inspect the production app on desktop and mobile: Dashboard, filters, Offers, Create, Deal Detail, agreement clauses, evidence review, history, explorer links, loading/error states, and no console or overflow errors.
4. Refresh the production screenshot and submission documentation if visible output differs.
5. Commit and push the completed production checkpoint, then verify GitHub CI.

## Final Submission Gate

ClauseFlow is ready to submit only when the final contract has both `PAID` and `REFUNDED` histories visible on the public Dashboard, production points to that contract, all checks pass, GitHub is current, and documentation claims only verified facts.
