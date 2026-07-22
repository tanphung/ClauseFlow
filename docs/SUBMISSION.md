# ClauseFlow Project Submission Notes

## What ClauseFlow Does

ClauseFlow lets a Builder publish a precise service agreement and lets a Client fund it with GEN. The funded clauses become the immutable review standard. After delivery, GenLayer validators fetch the submitted public evidence, compare it with those exact clauses, and decide whether the Builder may receive payment, must revise the work, or the Client may receive a refund.

The public Dashboard shows the full agreement, evidence review, and final GEN movement from contract views. It does not rely on a private database or a mocked history.

## The Trust Problem

Remote work escrow has a difficult boundary: deterministic code can enforce amounts, roles, deadlines, and one-time settlement, but it cannot establish whether a live website, documentation set, demo, or public repository actually satisfies a written delivery agreement.

ClauseFlow uses GenLayer only at that boundary. Validators fetch the evidence themselves and compare material findings such as accessibility, deliverable coverage, acceptance-criteria coverage, missing items, score, and decision. The result controls escrow eligibility, so consensus protects a real transfer of value rather than producing advice or a better chatbot answer.

## How To Use It

1. The Builder drafts an offer, asks validators to structure complete clauses, reviews them, and publishes the offer.
2. The Client accepts the exact on-chain clauses and locks the exact GEN amount.
3. The Builder submits public delivery, demo, documentation, and repository URLs.
4. Validators fetch the URLs and review the evidence against the funded clauses.
5. An approved Builder claims payment. A rejected, expired, or revision-exhausted deal can become refundable under deterministic rules.
6. The Dashboard shows the agreement timeline, review findings, transaction proof, and paid or refunded amount.

## Verified Build

- Network: GenLayer Testnet Bradbury, chain ID `4221`
- Contract: `0x993D37D07e31d8e3853B8702919f4d805299B124`
- Deploy transaction: `0xeb762c3f00ebf8cc518e1c2a394b57f18b1d17cad0be4b61ad833a7b77f23d02`
- Contract result: `ACCEPTED / AGREE / FINISHED_WITH_RETURN`
- Payment smoke: deal `1` reached `PAID` with `0.02 GEN`
- Refund smoke: deal `2` reached `REFUNDED` with `0.015 GEN`
- Final contract balance: `0 GEN`
- Real evidence: [Mochi-Game source](https://github.com/tanphung/Mochi-Game) and [live app](https://mochi-game-frontend.vercel.app/)
- Automated checks: GenVM lint, five direct contract tests, six frontend component tests, TypeScript, production build, and desktop/mobile browser flows

## Reviewer Links

- Source: [github.com/tanphung/ClauseFlow](https://github.com/tanphung/ClauseFlow)
- Contract explorer: [Bradbury contract](https://explorer-bradbury.genlayer.com/address/0x993D37D07e31d8e3853B8702919f4d805299B124)
- Live frontend: [clauseflow-two.vercel.app](https://clauseflow-two.vercel.app)
- Demo video: ready to record from the verified live flow

## Why This Is A Project

ClauseFlow includes the Intelligent Contract, a contract-connected frontend, wallet and transaction lifecycle handling, public history views, settlement verification, tests, deployment tooling, and a path to real Builder/Client pilots. It should be reviewed as one continuing Project, not as a standalone contract or a collection of small variations.
