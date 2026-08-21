# ClauseFlow v2 Project Submission Notes

This file is a candidate reviewer package. Final addresses, transaction links, totals, and the v2 demo video must be inserted only after clean Bradbury verification.

## Title

ClauseFlow: Enforceable Evidence-Verified Service Agreements

## Notes / Description

ClauseFlow turns natural-language service promises into an executable acceptance workflow on GenLayer.

Before funding, every binding promise is represented by a stable obligation ID, acceptance rule, and required evidence types. The Client locks GEN against that exact manifest. The Builder then submits immutable version-bearing URLs and SHA-256 digests. A leader assesses every obligation, while protocol-selected validators independently refetch the sources and verify the version, digest, obligation coverage, findings, reasoning, score, missing items, and settlement decision. Matching JSON or matching prose is not enough.

Deterministic code enforces the funded delivery, grace, revision, review-timeout, and refund rules. Settlement uses a dedicated router receipt bound to the exact deal, ClauseFlow source, recipient, amount, payment/refund kind, and released state. This closes the gap between what the parties accepted and what settlement actually enforces.

The repository contains the complete Intelligent Contract, Settlement Router, public dApp, tests, deployment tooling, architecture, and evidence dossier. The final submission will include an end-to-end video showing the two-wallet Bradbury pilot and independent validator reports.

## Why GenLayer Is Required

Addresses, amounts, clocks, counters, and receipt identity are deterministic. Whether a deployed application, source tree, audit, or report materially satisfies a funded natural-language obligation is not. That evidence judgment changes payment or refund eligibility, making validator consensus the product's trust boundary rather than an attached AI feature.

## Reviewer Path

1. Open the public Dashboard without a wallet.
2. Open the approved agreement and inspect every accepted obligation, commit-pinned evidence, detailed validator reasoning, exact payment receipt, and `PAID` history.
3. Open the rejected audit agreement and inspect the absent required audit evidence, per-obligation rejection, exact refund receipt, and `REFUNDED` history.
4. Compare the contract and router fields with the explorer transactions in `docs/DEPLOYMENT.md`.
5. Open **New offer** and confirm every binding term is explicit before publishing.
6. Review the source and automated test gates.

## Final Proof Checklist

- GenLayer Testnet Bradbury, chain ID `4221`
- v2 ClauseFlow address and deployment transaction
- bound Settlement Router address and deployment transaction
- 22-method ClauseFlow schema and empty initial views
- payment pilot with exact `APPROVED` per-obligation report and released Builder receipt
- refund pilot with exact `REJECTED` per-obligation report and released Client receipt
- zero accounted escrow after both terminal confirmations
- public commit-pinned evidence and SHA-256 values
- new v2 video URL

## Category

Submit the complete repository as one **Project**. Do not submit the contract separately as an Intelligent Contract and do not describe this release as a Milestone.
