# ClauseFlow v2 Release Checklist

## Source Gates

- [ ] `npm audit --omit=dev` reports zero production vulnerabilities
- [ ] `npm run lint:contract` reports 21 methods and no errors
- [ ] `py -3.13 -m pytest tests/direct -q` passes
- [ ] `npm test` passes frontend and router tests
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test:e2e` passes
- [ ] Secret and tracked-artifact scans are clean

## Deployment Gates

- [ ] Bradbury network, three wallet identities, and balances pass preflight
- [ ] Settlement Router deployment is mined and bytecode is present
- [ ] ClauseFlow deployment is `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- [ ] ClauseFlow exposes 21 methods and empty initial offer/deal views
- [ ] Router is permanently bound to the exact ClauseFlow address
- [ ] Runtime config is updated only after all checks above
- [ ] GitHub and Vercel publicly serve the exact commit used for evidence

## Pilot Gates

- [ ] Paid agreement adjudicates every accepted obligation against immutable evidence
- [ ] Paid agreement ends with an exact released Builder receipt and `PAID`
- [ ] Refund agreement adjudicates every accepted obligation and truthfully rejects the missing audit
- [ ] Refund agreement ends with an exact released Client receipt and `REFUNDED`
- [ ] Every write records activation hash, GenLayer hash, lifecycle, consensus, execution, and resulting state
- [ ] Final stats and router receipts reconcile with zero accounted escrow

## Submission Gates

- [ ] README, evidence dossier, deployment proof, and submission notes contain only verified v2 claims
- [ ] Production snapshot matches the final contract and router
- [ ] Desktop and responsive production QA pass without console errors or overflow
- [ ] New v2 video shows independent validator refetch, detailed reports, exact payment, exact refund, and empty Create state
- [ ] GitHub Actions is green and Vercel is Ready
- [ ] Working tree is clean and no runtime checkpoint, secret, or temporary media is tracked
