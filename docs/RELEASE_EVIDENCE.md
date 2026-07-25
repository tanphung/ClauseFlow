# ClauseFlow Evidence Crosswalk

Validators fetch the live app, contract source, and README; each proves the same Bradbury escrow lifecycle.

`publish_offer`: Builder's New offer -> Dashboard.
`accept_offer`: Client locks exact GEN -> funded deal and parties.
`submit_delivery`: Builder adds URLs -> Deal Detail.
`review_delivery`: validators fetch URLs -> criterion, deliverable, source, and reasoning report.
`claim_payment`/`confirm_payment`: approved -> Builder transfer -> `PAID` after balance proof.
`claim_refund`/`confirm_refund`: rejected or eligible -> Client return -> `REFUNDED` after balance proof.
`get_deal_history`/`get_dashboard_stats`: public timeline, totals, and zero active escrow.

Live app: https://clauseflow-two.vercel.app. Source: `contracts/clauseflow.py`. README matches it. UI, source, and docs must materially match this map; access alone is insufficient.
