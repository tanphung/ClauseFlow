# ClauseFlow Security

ClauseFlow is a Bradbury testnet pilot and has not received a professional security audit. Do not treat it as production custody software.

## Trust Boundaries

- Deterministic contract logic controls parties, exact attoGEN funding, deadlines, revisions, eligibility, settlement state, and public history.
- Public delivery URLs and Builder notes are untrusted inputs.
- The leader report is an untrusted claim. Protocol-selected validators independently refetch evidence and verify accessibility, criteria, deliverables, missing items, score, and decision.
- The frontend renders contract views and transaction receipts; it is not the source of settlement truth.

## Threats And Mitigations

| Threat | Current mitigation | Remaining limitation |
| --- | --- | --- |
| Prompt injection in evidence | Fixed funded criteria remain authoritative; the contract derives score and outcome; validators must reject unsupported leader claims. | Model-level prompt injection cannot be proven impossible. Evidence should never be treated as instructions. |
| Empty, irrelevant, or misleading evidence | Material criteria and deliverables require direct supporting findings; accessibility or valid JSON alone is insufficient. | Semantic judgment remains nondeterministic and depends on validator consensus. |
| Malformed model output | Structured fields are normalized and bounded; invalid top-level output raises a controlled error before storage changes. | A failed review must be retried after diagnosing whether the failure is evidence-related or infrastructural. |
| Unauthorized or repeated settlement | Party checks, status checks, mutually exclusive terminal flags, and exact escrow accounting reject unauthorized or duplicate claims. | The deployed pilot is not a substitute for a professional escrow audit. |
| Stale frontend state | Live views replace a contract-bound snapshot; writes require successful execution, consensus, and refreshed on-chain state. | Bradbury RPC or indexing delays can temporarily leave the labeled snapshot visible. |
| Mutable URL evidence | Validators fetch submitted public URLs during review and record their findings on-chain. | URL content is not snapshotted or content-addressed and can change after review. Historical findings describe what validators observed, not permanent artifact availability. |
| External GEN transfer failure | Claims enter a pending state and terminal status requires a balance-backed confirmation after the child transfer. | Deployed v1 has no timeout, retry, or rollback path if a child transfer remains failed; a deal can remain `PAYMENT_PENDING` or `REFUND_PENDING`. |

## Reporting

Report security issues through a private repository-owner channel rather than publishing wallet details, private keys, or exploitable transaction instructions in a public issue. Never include `.env` contents or seed phrases in a report.
