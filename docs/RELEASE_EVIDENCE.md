# ClauseFlow v2 Release Evidence Dossier

This document is the public delivery artifact for the v2 release pilot. Validators must assess its immutable commit-pinned version, not the mutable `main` branch.

## Material Obligations

### O_METHODS: complete method coverage

The v2 Intelligent Contract exposes 21 public methods. This dossier maps every method and the router release path to its executable consequence.

| Contract method | Interface action or public proof | Enforced consequence |
| --- | --- | --- |
| `structure_offer` | New offer / Structure exact terms | Validate the complete obligation and timing manifest |
| `publish_offer` | New offer / Publish reviewed offer | Publish only the matching structured manifest |
| `accept_offer` | Offers / Accept and lock | Freeze exact obligations and exact GEN amount |
| `submit_delivery` | Deal / Evidence / Submit | Append a version- and digest-bound evidence round |
| `review_delivery` | Deal / Evidence / Review | Adjudicate exactly every accepted obligation |
| `claim_payment` | Deal / Settlement / Start payment | Fund the exact Builder receipt after approval |
| `confirm_payment` | Deal / Settlement / Confirm | Record `PAID` only for the exact released receipt |
| `claim_refund` | Deal / Settlement / Start refund | Fund the exact Client receipt when deterministic policy allows |
| `confirm_refund` | Deal / Settlement / Confirm | Record `REFUNDED` only for the exact released receipt |
| `get_protocol_policy` | Contract profile | Read v2 limits and router address |
| `get_structured_offer` | New offer state | Read the Builder's current structured manifest |
| `get_offer` | Offer detail | Read immutable published terms |
| `get_deal` | Deal detail | Read parties, obligations, review, and settlement receipt |
| `get_offer_ids` | Offers | Enumerate published offers |
| `get_deal_ids` | Dashboard | Enumerate funded agreements |
| `get_completed_deal_ids` | Dashboard | Enumerate terminal agreements |
| `get_deals_for_address` | Dashboard filters | Read agreements involving one address |
| `get_deal_history` | Deal / On-chain history | Read append-only lifecycle entries |
| `get_evidence_rounds` | Deal / Evidence | Read all immutable submission rounds |
| `get_refund_eligibility` | Deal / Settlement | Read deterministic reason and eligibility |
| `get_dashboard_stats` | Dashboard summary | Read funded, pending, paid, refunded, and escrow totals |

`SettlementRouter.release_settlement` is the recipient-controlled EVM action between a finalized claim and ClauseFlow confirmation. `matches_released` is the exact receipt check used by ClauseFlow.

### O_TERMS: funded policy is executable

The accepted offer stores the obligation manifest and hash, delivery window, grace period, maximum revisions, revision window, review window, parties, and exact amount. The contract then enforces:

- no delivery after the stored deadline plus grace;
- no extra revision after the stored maximum;
- no revision after the stored revision window;
- Client refund after missed delivery, missed revision, rejected delivery, or review timeout;
- Builder payment only after all accepted obligations are satisfied;
- one mutually exclusive terminal settlement.

Validator prose cannot alter any of these rules.

### O_RECEIPT: exact deal and recipient confirmation

The Intelligent Contract and router jointly bind settlement to:

- deterministic settlement ID;
- hash of the exact deal ID;
- bound ClauseFlow source address;
- exact Builder or Client recipient;
- exact funded attoGEN amount;
- payment or refund kind;
- released receipt state.

An aggregate balance decrease or unrelated transfer cannot confirm a deal.

### O_INTERFACE: public v2 record

The React interface renders the accepted obligation manifest, evidence IDs and immutable versions, SHA-256 digests, evidence rounds, deterministic deadline and refund state, per-obligation findings and validator reasoning, source verification, and exact router receipt fields.

The interface does not derive replacement analysis from PASS/FAIL. If structured fields are absent, it states that the detailed data was not stored.

## Independent Verification

For the paid release pilot, the submitted evidence manifest pins the exact Git commit for this dossier, the Intelligent Contract, Settlement Router, README, and interface source. Each source includes the expected SHA-256 digest computed before submission.

The leader must fetch those sources and assess all four funded obligation IDs. Protocol-selected validators independently refetch the same URLs and verify source accessibility, immutable versions, digests, required evidence types, obligation coverage, findings, reasoning, score, missing items, and settlement decision. Matching JSON or prose alone is insufficient.

## Release Identity

- Live app: https://clauseflow-two.vercel.app
- Repository: https://github.com/tanphung/ClauseFlow
- Final v2 ClauseFlow address: pending clean Bradbury deployment
- Final v2 Settlement Router address: pending clean Bradbury deployment
- Final v2 transaction proof: pending end-to-end verification

These pending fields must be replaced with explorer-verifiable values before Project resubmission.
