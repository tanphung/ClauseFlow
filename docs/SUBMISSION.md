# ClauseFlow Project Submission Notes

## Plain-Language Summary

ClauseFlow is a two-party service-agreement dApp. A Builder publishes objective terms, a Client locks the exact GEN price, and GenLayer validators inspect public delivery evidence against the funded clauses. Their consensus determines whether the Builder can be paid, must revise, or the Client can receive a refund.

## Why GenLayer Is Required

Deterministic code handles addresses, amounts, deadlines, revisions, and one-time settlement. The unresolved trust problem is whether public web, source, demo, and documentation evidence actually satisfies natural-language obligations. ClauseFlow validators independently fetch that evidence and verify material criterion and deliverable findings. The result changes escrow eligibility, so this is not advice or an AI answer product.

## Reviewer Path

1. Open the [public Dashboard](https://clauseflow-two.vercel.app) without a wallet.
2. Compare its totals with the final proof in [DEPLOYMENT.md](DEPLOYMENT.md).
3. Open the paid agreement and inspect accepted terms, evidence, detailed validator reasoning, transfer, and terminal history.
4. Open the refunded agreement and inspect the missing audit evidence, rejection reasoning, refund, and terminal history.
5. Filter by Builder and Client address.
6. Open **New offer** and confirm the workspace starts empty.
7. Follow contract and transaction links to verify Bradbury state independently.

## Verified Release

- Network: GenLayer Testnet Bradbury, chain ID `4221`
- Contract: `0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D`
- Deployment: `0x3e2ad3fd2f4c980dc5d481d253e072b501a0508206a3f6c91245e2dc538e5737`
- Deployment result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Schema: 18 methods
- Live frontend: https://clauseflow-two.vercel.app
- Source: https://github.com/tanphung/ClauseFlow

The two-wallet Bradbury pilot is terminal: deal `#1` is `PAID` after an `APPROVED` `100/100` evidence review, and deal `#2` is `REFUNDED` after a `REJECTED` `0/100` non-delivery review. Canonical totals are `0.035 GEN` funded, `0.02 GEN` paid, `0.015 GEN` refunded, and zero active escrow or contract balance. Exact transaction links and view results are in [DEPLOYMENT.md](DEPLOYMENT.md). These are testnet pilot transactions, not a claim of external customer adoption.

## Category

Submit the complete repository as one **Project**. Do not submit the contract separately as an Intelligent Contract and do not describe this release as a Milestone.
