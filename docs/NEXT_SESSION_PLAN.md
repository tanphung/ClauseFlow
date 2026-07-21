# ClauseFlow Next Session Plan

Use this checklist when the user says: `Lam theo ke hoach tiep theo`.

## Safety Boundary

- Create, edit, or delete files only inside `D:\app genlayer\ClauseFlow`.
- Files outside that directory are read-only reference material.
- Never print or commit `.env` values, private keys, passwords, or seed phrases.
- Keep every test agreement below `0.5 GEN`.

## Current Public State

- Repository: `https://github.com/tanphung/ClauseFlow`
- Production frontend: `https://clauseflow-two.vercel.app`
- Current Bradbury contract: `0xA851b0D3cD85f5Abc91E459C172bc326d5A41bdf`
- Current verified paid deal: deal `1`, `PAID`, `0.01 GEN`
- Refund smoke deal: deal `2`, `REFUND_PENDING`, `0.015 GEN`
- Deal `2` review result: `REJECTED`
- Review transaction: `0xaa13ccdf6756766466a5b9656e12c4f3c15ea853d0b5a554990c1c46fd8fea61`
- Claim-refund parent transaction: `0x3a1860e8307eea718f82b20d5d838a5a14887480dd932145f722efc4b3be6028`
- Claim transaction was `ACCEPTED / AGREE / FINISHED_WITH_RETURN` when the session stopped.
- Current dashboard totals: 2 offers, 2 deals, 1 completed, `0.01 GEN` paid, `0 GEN` refunded.
- Current contract balance: `0.015 GEN`; accounted escrow is already `0` because the refund transfer was emitted.

## Resume Order

1. Query the claim-refund transaction above. Do not submit `claim_refund` again.
2. When it reaches `READY_TO_FINALIZE`, finalize it with the Client wallet from `ClauseFlow3_PRIVATE_KEY`.
3. Wait until the parent is `FINALIZED` and the contract balance becomes `0`.
4. Call `confirm_refund("2")` with the same Client wallet.
5. Verify deal `2` becomes `REFUNDED` and Dashboard totals become: completed `2`, paid `0.01 GEN`, refunded `0.015 GEN`.
6. Finish and test the frontend fixed-gas Bradbury submitter in `src/lib/genlayer.ts`. It must encode `addTransaction`, use a `5,000,000` gas limit, extract the GenLayer transaction ID from `NewTransaction`/`CreatedTransaction`, and wait for a real execution result instead of treating `NOT_VOTED` as failure.
7. Verify Deal Detail opens `Full accepted terms` by default and can still be collapsed.
8. Run the full local gate: npm audit, component tests, typecheck, build, GenVM lint, direct contract tests, and desktop/mobile E2E.
9. Commit and push every completed checkpoint before deployment.
10. Clean-deploy the final contract only after the source gate is green. Record deployer, deploy transaction, result, address, schema, and basic view output without exposing credentials.
11. Update `public/config.js` to the final verified address, then run one real payment and one real refund agreement with separate Builder and Client wallets. Use only real public project evidence and values below `0.5 GEN`.
12. Update README, deployment notes, submission notes, screenshots, and Vercel production. Push the final commit and wait for GitHub CI.
13. Inspect the public app on desktop and mobile: Dashboard, filters, Offers, Create, Deal Detail, agreement clauses, evidence review, history, explorer links, loading/error states, and no console or overflow errors.

## Final Submission Gate

ClauseFlow is ready to submit only when the final contract has both `PAID` and `REFUNDED` histories visible on the public Dashboard, production points to that contract, all checks pass, GitHub is current, and documentation claims only verified facts.
