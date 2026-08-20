# ClauseFlow Security

ClauseFlow is Bradbury testnet software and has not received a professional security audit. It must not be treated as production custody infrastructure.

## Trust Boundaries

- The Intelligent Contract controls obligation identity, parties, exact amount, timestamps, revision/refund policy, settlement eligibility, and history.
- Public evidence and delivery notes are untrusted.
- The leader report is untrusted. Protocol-selected validators independently refetch version-bound evidence and verify every material assessment.
- The EVM router controls the exact recipient release and deal-specific receipt.
- The frontend renders contract and router data; it is not settlement truth.

## Threats And Mitigations

| Threat | v2 mitigation | Remaining limitation |
| --- | --- | --- |
| Broad terms omitted from review | Funding freezes 1-12 stable obligation IDs; review requires exactly one assessment per ID. | Parties must express every binding promise as an obligation before funding. |
| Prompt injection or unsupported leader claims | Validators independently refetch sources and verify findings, reasoning, evidence coverage, score, and decision. | Semantic judgment remains nondeterministic and model-level prompt injection cannot be proven impossible. |
| Evidence changes after review | Version kind, version ID, URL, and expected SHA-256 are stored; each review verifies the binding. | External hosts may later become unavailable even though the digest remains recorded. |
| Revision or refund policy drift | Deterministic timestamps and counters enforce delivery, grace, revision, revision-window, review-timeout, and rejection rules. | Bradbury clock and finality remain protocol dependencies. |
| Unrelated transfer confirms a deal | Terminal confirmation requires the exact router receipt, deal hash, source, recipient, amount, kind, and released state. | The router and Intelligent Contract have not been professionally audited. |
| Unauthorized or repeated settlement | Source binding, recipient checks, one-time receipt state, terminal deal state, and reentrancy protection. | A recipient must actively release a funded router receipt. |
| Failed recipient transfer | The router call reverts and retains `FUNDED`, allowing the same recipient to retry. | A recipient contract that always rejects GEN cannot complete release. |
| Stale frontend state | Contract-bound snapshot is labeled; finalized execution and refreshed state are required for write success. | RPC/indexing delays may temporarily leave the last verified snapshot visible. |

## Reporting

Report security issues privately to the repository owner. Do not publish wallet secrets or actionable exploit details in a public issue.
