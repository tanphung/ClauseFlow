# ClauseFlow Release Evidence Dossier

ClauseFlow is a public Bradbury agreement protocol. This dossier is the Builder's versioned delivery for the on-chain agreement titled **ClauseFlow release evidence dossier**. It deliberately maps each public artifact to the same verifiable lifecycle, so accessibility alone is not treated as acceptance evidence.

## Four-source Verification Map

| Required source | Public URL | What it proves |
| --- | --- | --- |
| Live ClauseFlow application | https://clauseflow-two.vercel.app | The usable Dashboard, Offers, Create, and Deal Detail interface reads Bradbury contract state and presents agreement, review, and settlement history. |
| Intelligent contract source | https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py | The `ClauseFlow` contract stores offers and deals, locks the exact GEN value, records evidence reviews, and permits idempotent payment or refund settlement. |
| Frontend source | https://github.com/tanphung/ClauseFlow/tree/main/src | The React client calls the public contract views, filters public history, and verifies write receipts before showing a completed transaction. |
| Reviewer documentation | https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md | The implementation notes, test commands, Bradbury address, and two-party review workflow are documented for an independent reviewer. |

## Lifecycle Crosswalk

1. The **Builder publishes** an offer with scope, deliverables, acceptance criteria, deadline, revision limit, and an exact GEN price.
2. The **Client funds** it with that exact GEN amount. The contract records the parties and locks escrow; the Dashboard exposes the resulting `FUNDED` deal.
3. The **Builder submits public evidence**. This dossier, live app, contract source, and README are the evidence package for this release.
4. **Bradbury validators independently fetch and compare** those sources against the accepted terms. The contract records accessible sources, deliverable findings, criterion findings, missing items, score, reasoning, and the consensus decision.
5. An `APPROVED` deal can enter payment settlement for the Builder. A rejected or deterministically refund-eligible deal can enter refund settlement for the Client. Terminal `PAID` and `REFUNDED` states require a settled escrow confirmation and remain in public on-chain history.

## Validator Checks

- Fetch every URL in the table and confirm it is publicly accessible.
- Confirm the application, Python contract, frontend source, and README all describe the same ClauseFlow offer -> fund -> submit -> validator review -> settle lifecycle.
- Confirm the contract exposes material outcome checks and public history, rather than only validating JSON format.
- Treat a missing source, a broken application, or a lifecycle mismatch as a material evidence gap.

The browser reads the public Bradbury address from `public/config.js`. No private key is needed to inspect this dossier or the public Dashboard.
