# ClauseFlow Architecture

## Trust Boundary

| Layer | Responsibility |
| --- | --- |
| React dApp | Wallet connection, transaction truth, public views, filters, explorer links |
| Intelligent Contract | Immutable terms, escrow, evidence review, eligibility, settlement, statistics, history |
| Public evidence | Delivery, demo, documentation, and source URLs submitted by the Builder |
| Bradbury validators | Independent fetching and material verification of the settlement report |

## Consensus Design

`structure_offer` deterministically canonicalizes the Builder's complete inputs, exact payment, deadline, revision, and refund metadata without asking an LLM to invent or reinterpret obligations. `publish_offer` rejects empty, changed, or reused drafts. Consensus is reserved for the evidence-dependent settlement decision where it solves the actual trust problem.

`review_delivery` is the settlement trust boundary:

1. The leader independently fetches all submitted sources and creates a detailed report for every immutable criterion and deliverable.
2. The contract normalizes assessment statuses and deterministically derives score and result.
3. Each validator independently refetches the sources.
4. Without seeing the leader report, each validator produces its own compact assessment for every criterion and deliverable from its independently fetched evidence.
5. The contract derives each side's result from full criterion and deliverable coverage, then requires the same settlement outcome and obligation structure. Approval additionally requires a 100 score, every item satisfied, and common supporting evidence URLs. Free-form wording, partial-status placement, and transient fetch-count differences are not consensus fields.
6. Storage changes occur only after consensus returns.

Validators do not approve JSON format or identical prose. Approval requires every obligation to be `SATISFIED`, a score of 100, accessible supporting evidence, and no missing items.

## Escrow And Settlement

`accept_offer` requires the exact attoGEN price and increases funded and accounted escrow. A payment/refund claim checks authorization and eligibility, moves the deal to a pending state, decreases accounted escrow, records the expected post-transfer balance, and emits an external GEN transfer.

External messages execute after parent finalization. `confirm_payment` and `confirm_refund` reach terminal state only after the contract balance proves the transfer occurred. Paid and refunded paths are mutually exclusive and idempotent.

## Public History

Each deal keeps immutable parties and amount together with evidence, review, settlement fields, timestamps, and a lifecycle timeline. `get_dashboard_stats` and address-filter views expose canonical history directly; no private database or indexer is required for v1.
