# ClauseFlow v2 Architecture

## Components

| Layer | Responsibility |
| --- | --- |
| React dApp | Public views, wallet discovery, immutable evidence input, transaction truth, receipt rendering |
| GenLayer Intelligent Contract | Frozen obligations, evidence rounds, consensus adjudication, deterministic eligibility, canonical history |
| EVM Settlement Router | Deal-specific funded receipt and recipient-controlled release |
| Public immutable evidence | Version-bearing HTTPS artifacts with expected SHA-256 digests |
| Bradbury validators | Independent refetch and material verification of every accepted obligation |

## Accepted Agreement

`structure_offer` and `publish_offer` accept the exact obligation manifest rather than asking an LLM to rewrite a broad scope. Each obligation has a stable ID, category, statement, acceptance rule, and required evidence types. Duplicate IDs, empty material fields, unsupported categories, unsupported evidence types, and manifests outside the 1-12 limit are rejected.

`accept_offer` freezes the full manifest and hash with the parties, exact amount, delivery window, grace period, revision count, revision window, and review timeout. The contextual service description does not silently become an additional obligation.

## Immutable Evidence Rounds

`submit_delivery` validates a manifest of 1-8 evidence sources. Each source declares a stable evidence ID and type, label and version-bearing HTTPS URL, immutable version kind and ID, and expected SHA-256 digest.

Supported bindings are Git commit URLs, IPFS CID URLs, and immutable Vercel deployment URLs. The contract stores every round append-only. A revision appends a new round and leaves previous submissions available through `get_evidence_rounds`.

## Consensus Design

`review_delivery` is the only nondeterministic settlement boundary:

1. The leader refetches every source and verifies its declared immutable version and digest.
2. The leader returns exactly one structured assessment for every funded obligation ID and one source assessment for every evidence ID.
3. The contract rejects missing, duplicate, extra, or malformed IDs and derives the bounded score and decision from normalized assessments.
4. Protocol-selected validators independently refetch the same immutable URLs.
5. Validators treat the leader report as untrusted and verify source accessibility, version and digest matches, exact obligation coverage, required evidence-type coverage, findings, reasoning, missing items, score, and decision.
6. Matching JSON or prose is not an equivalence rule. Every material verification flag must be true.
7. Storage changes occur only after consensus returns and deterministic validation succeeds.

Approval requires every accepted obligation to be `SATISFIED`. Partial or missing support follows the funded revision policy; a terminally unsatisfied submission becomes `REJECTED`.

## Deterministic Policy

The contract computes delivery, grace, revision, review-timeout, and refund eligibility from stored timestamps and counters. The validator report cannot change these terms.

- A missed initial delivery after deadline plus grace is refundable.
- `REVISION_REQUIRED` is possible only when a funded revision remains.
- A revision must arrive inside the stored revision window.
- A submitted round that is not reviewed before the stored review timeout becomes refundable.
- A rejected submission is refundable.
- Payment requires `APPROVED`; payment and refund remain mutually exclusive.

## Settlement Router

The EVM `SettlementRouter` is deployed first and permanently bound to one ClauseFlow contract. Only that ClauseFlow source can fund a receipt. Each receipt stores its deterministic settlement ID, exact deal ID hash, source ClauseFlow address, recipient, exact amount, payment/refund kind, and `FUNDED` or `RELEASED` state.

After the GenLayer parent transaction finalizes, only the designated recipient can call `release_settlement`. The router uses checks-effects-interactions and a reentrancy guard; a failed recipient transfer reverts the receipt state.

ClauseFlow terminal confirmation calls `matches_released` with all deal-specific fields. An unrelated transfer, recipient, amount, kind, source contract, or receipt cannot complete the deal.

## Public State

Contract views are canonical. The dashboard snapshot is a timestamped UX cache accepted only for the exact network, ClauseFlow address, router address, and protocol version. Live reads replace it. Offers and histories load lazily, and deal changes invalidate cached history.
