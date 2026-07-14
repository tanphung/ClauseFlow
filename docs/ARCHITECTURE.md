# ClauseFlow Architecture

## Trust Boundary

| Layer | Responsibility |
| --- | --- |
| Frontend | Wallet connection, transaction progress, public view rendering, filters, explorer links |
| Intelligent Contract | Agreement terms, escrow accounting, lifecycle state, evidence review, settlement eligibility, history |
| Public evidence sources | Delivery, demo, documentation, and repository content fetched independently by validators |
| Bradbury validators | Independent evidence review and agreement on settlement-critical material fields |

## Consensus Boundary

`structure_offer` deterministically converts Builder inputs into canonical clauses and binds the resulting draft to the exact source fields. `publish_offer` rejects changed or reused drafts.

`review_delivery` is nondeterministic because public pages and natural-language acceptance criteria require judgment. The leader and validators independently fetch evidence and run the same constrained review. Consensus compares the final decision, accessibility count, score thresholds, and satisfied-criteria fields. Merely returning valid JSON is insufficient.

## Escrow And Settlement

`accept_offer` requires the exact attoGEN price and increases both total funded and accounted escrow. A payment/refund claim first changes the deal to a pending state, decreases accounted escrow, records the expected post-transfer balance, and emits an external GEN transfer. Confirmation succeeds only when the contract balance is at or below the recorded expected balance.

This design permits multiple funded deals and concurrent pending settlements without a single global lock. Terminal deals are appended to `completed_deal_ids`, and all totals remain queryable from `get_dashboard_stats`.

## Public History

Each deal stores immutable party/amount fields plus mutable lifecycle fields. `deal_histories` records actor, event type, timestamp, and a concise note for each transition. The Dashboard uses contract views directly as the v1 source of truth; no private database or off-chain indexer is required.
