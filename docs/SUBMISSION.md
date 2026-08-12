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
- Contract: `0xcD7cD682b3e490cf100e03bBeeC2F0f6a5776b6d`
- Deployment: `0xcbe2bc80486dafc4833788e99d1a33db71ebfddeb3c5ad0366f8b7e9ef7d77ab`
- Deployment result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Schema: 18 methods
- Live frontend: https://clauseflow-two.vercel.app
- Source: https://github.com/tanphung/ClauseFlow

The final paid/refunded hashes and aggregate views are appended after the two-wallet Bradbury pilot reaches terminal state. These are testnet pilot transactions, not a claim of external customer adoption.

## Category

Submit the complete repository as one **Project**. Do not submit the contract separately as an Intelligent Contract and do not describe this release as a Milestone.
