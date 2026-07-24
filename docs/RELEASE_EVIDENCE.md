# ClauseFlow Release Evidence Dossier

This public dossier is the Builder delivery for **ClauseFlow release evidence dossier**. It maps four independently fetchable sources to one Bradbury agreement lifecycle: Builder publishes immutable terms and exact GEN price; Client funds that exact amount into contract escrow; Builder submits these public sources; validators compare their actual content with the accepted terms; an approved deal pays the Builder, while a rejected or deterministic refund-eligible deal returns escrow to the Client. The contract retains the terms, evidence report, decision, and terminal settlement in public history.

## Required Public Sources

- **Live application:** https://clauseflow-two.vercel.app - usable Dashboard, Offers, Create, and Deal Detail views reading Bradbury state.
- **Intelligent contract:** https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py - offer, exact funding, delivery, substantive review, payment, refund, and history logic.
- **Frontend source:** https://github.com/tanphung/ClauseFlow/tree/main/src - React contract reads, filters, lifecycle display, and receipt checks.
- **Reviewer documentation:** https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md - installation, tests, network setup, and the same two-party workflow.

## Validator Checks

Fetch each source. Confirm that all four describe the same application, contract behavior, and lifecycle above. Accessibility alone is insufficient: the visible UI, public code, and documentation must materially support the accepted deliverables and criteria. A missing source, broken application, or mismatch is a material evidence gap.

No private key is needed to inspect this dossier or the public Dashboard.
