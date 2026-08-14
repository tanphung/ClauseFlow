# ClauseFlow Project Submission Notes

## Portal Copy

**Title:** ClauseFlow: Evidence-Verified Escrow with Balance-Proven Settlement

**Notes / Description:**

ClauseFlow is a working GenLayer Bradbury dApp where validator consensus directly controls GEN escrow. A Builder publishes immutable terms, a Client locks the exact amount, and the Builder submits public delivery evidence. The leader creates a detailed report, but protocol-selected validators treat it as untrusted, independently refetch every URL, and verify accessibility, criteria, deliverables, missing items, score, and settlement decision. The full report is stored on-chain; the frontend renders it without inventing rationale. Claims first enter pending states, and terminal PAID or REFUNDED status requires contract-balance confirmation. The public Dashboard exposes the complete lifecycle without a wallet or private indexer. The verified two-wallet pilot shows 0.02 GEN paid, 0.015 GEN refunded, and zero active escrow. The attached X post includes a professional demo video of both paths.

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

## Known Limitations

Submitted evidence uses mutable public URLs rather than content-addressed snapshots. The deployed v1 also has no timeout, retry, or rollback path for a failed external child transfer after a claim enters `PAYMENT_PENDING` or `REFUND_PENDING`. These boundaries and mitigations are documented in [SECURITY.md](../SECURITY.md); they are not concealed by the frontend or submission claims.

The repository hardening checks CI, direct tests, frontend tests, build output, and the frozen deployed-source hash without sending Bradbury transactions. The owner release steps are listed in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Category

Submit the complete repository as one **Project**. Do not submit the contract separately as an Intelligent Contract and do not describe this release as a Milestone.
