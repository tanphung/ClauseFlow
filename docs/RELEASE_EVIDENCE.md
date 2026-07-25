# ClauseFlow Cross-Source Method Matrix

This is an explicit Contract -> Live app -> README comparison. All three submitted sources must show the same Bradbury lifecycle.

| Contract method | Live app flow | README flow |
| --- | --- | --- |
| `publish_offer` | New offer | publish terms |
| `accept_offer` | Offer funding | exact GEN lock |
| `submit_delivery` | Deal Detail | evidence submission |
| `review_delivery` | Deal Detail review | validator decision |
| `claim_payment` | Deal payment | Builder claim |
| `confirm_payment` | Deal payment | balance-proved PAID |
| `claim_refund` | Deal refund | Client claim |
| `confirm_refund` | Deal refund | balance-proved REFUNDED |
| `get_deal_history` | timeline | public history |
| `get_dashboard_stats` | Dashboard totals | public totals |

Live app: https://clauseflow-two.vercel.app. Contract source: `contracts/clauseflow.py`. README is the third comparison source. Access alone is insufficient: the three sources must materially match this table.
