# ClauseFlow Release Evidence Dossier

This versioned dossier is the Builder's public deliverable for the `ClauseFlow release evidence dossier` Bradbury pilot agreement.

## Release Identity

- Live app: https://clauseflow-two.vercel.app
- Source: https://github.com/tanphung/ClauseFlow
- Contract: https://explorer-bradbury.genlayer.com/address/0x90ef8Bc9f3AF76861Da8FeC0502aA045e697AAd3
- Deployment: https://explorer-bradbury.genlayer.com/tx/0x5288569c15e0238ef8e037f01645cd2d3657604ead786370852c1f704d8b4e71
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
