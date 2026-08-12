# ClauseFlow Release Evidence Dossier

This versioned dossier is the Builder's public Markdown deliverable and cross-source reviewer matrix for the `ClauseFlow release evidence dossier` Bradbury pilot agreement.

| Contract method | Live interface | README consequence |
| --- | --- | --- |
| `publish_offer` | New offer | publish immutable terms |
| `accept_offer` | Fund exact GEN | lock the exact displayed amount |
| `submit_delivery` | Evidence submission | store public delivery URLs |
| `review_delivery` | Validator review | decide approval, revision, or rejection |
| `claim_payment` + `confirm_payment` | Builder payment | finalize transfer, then balance-prove `PAID` |
| `claim_refund` + `confirm_refund` | Client refund | finalize transfer, then balance-prove `REFUNDED` |
| `get_deal_history` | On-chain history | read canonical lifecycle events |
| `get_dashboard_stats` | Protocol summary | read funded, paid, and refunded totals |

**Funded release rules:** the Client locked exactly `0.02 GEN`; `APPROVED` permits Builder payment; one revision is allowed within 24 hours; `REJECTED` or deadline plus the 24-hour grace period permits Client refund; external transfers execute after parent finalization; `PAID` or `REFUNDED` requires balance confirmation.

## Release Identity

- Live app: https://clauseflow-two.vercel.app
- Source: https://github.com/tanphung/ClauseFlow
- Contract: https://explorer-bradbury.genlayer.com/address/0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D
- Deployment: https://explorer-bradbury.genlayer.com/tx/0x3e2ad3fd2f4c980dc5d481d253e072b501a0508206a3f6c91245e2dc538e5737
- Direct contract source: https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py
- Reviewer documentation: https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md

The deployment is `FINALIZED / AGREE / FINISHED_WITH_RETURN`, exposes 18 public methods, and began with an empty offer list.

## Cross-Source Method Matrix

| Contract method | Live dApp action | README explanation |
| --- | --- | --- |
| `publish_offer` | New offer -> Publish reviewed offer | Publish immutable terms |
| `accept_offer` | Offer -> Fund exact displayed GEN | Exact escrow lock |
| `submit_delivery` | Deal Detail -> Submit delivery | Public evidence package |
| `review_delivery` | Evidence & review -> Run validator review | Evidence-based consensus decision |
| `claim_payment` | Settlement -> Claim payment | Builder payment emission |
| `confirm_payment` | Settlement -> Confirm payment | Balance-proved `PAID` state |
| `claim_refund` | Settlement -> Claim refund | Client refund emission |
| `confirm_refund` | Settlement -> Confirm refund | Balance-proved `REFUNDED` state |
| `get_deal_history` | On-chain history tab | Canonical lifecycle events |
| `get_dashboard_stats` | Protocol summary | Public funded/paid/refunded totals |

## Material Verification

Reviewers and validators can independently verify:

1. The live application exposes publishing, exact funding, evidence submission, validator review, payment, refund, and public history.
2. The direct source exposes every method named in the matrix.
3. The README describes the same lifecycle and settlement consequences.
4. The contract address in the live runtime config matches this dossier.

Access alone is insufficient. The four sources must materially agree on the lifecycle, and any contradiction should prevent approval.
