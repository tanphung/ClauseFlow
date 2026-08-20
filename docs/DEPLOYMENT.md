# ClauseFlow Deployment Proof

## v2 Candidate

The v2 source is not yet represented by the production runtime. This section will be populated automatically from verified deployment and pilot checkpoints before resubmission.

| Field | Verified value |
| --- | --- |
| Network | GenLayer Testnet Bradbury (`4221`) |
| ClauseFlow v2 | Pending clean deployment |
| Settlement Router | Pending clean deployment |
| Router binding | Pending verification |
| Deployment lifecycle | Pending verification |
| ClauseFlow schema | Expected: 21 methods |
| Initial offer/deal views | Expected: empty |
| Payment agreement | Pending |
| Refund agreement | Pending |
| Final escrow | Pending |

No v2 transaction is claimed successful from lifecycle status alone. Every recorded write must show finalized agreement, `FINISHED_WITH_RETURN`, and its expected refreshed state. Settlement additionally requires the exact router receipt to be released for the correct deal and recipient.

## Archived v1 Pilot

The previous public pilot remains available for historical transparency but is not proof of the v2 fixes requested by the steward.

- ClauseFlow v1: [`0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D`](https://explorer-bradbury.genlayer.com/address/0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D)
- Deployment transaction: [`0x3e2ad3fd2f4c980dc5d481d253e072b501a0508206a3f6c91245e2dc538e5737`](https://explorer-bradbury.genlayer.com/tx/0x3e2ad3fd2f4c980dc5d481d253e072b501a0508206a3f6c91245e2dc538e5737)
- Archived result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Archived schema: 18 methods

The v1 histories must not be presented as evidence that v2 exact-obligation, immutable-evidence, deterministic-timeout, or deal-specific receipt controls were executed.
