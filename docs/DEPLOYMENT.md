# ClauseFlow Deployment Proof

## v2 Candidate

The v2 contract pair is deployed and verified. Pilot settlement rows remain pending until both exact receipts reach terminal state.

| Field | Verified value |
| --- | --- |
| Network | GenLayer Testnet Bradbury (`4221`) |
| ClauseFlow v2 | [`0x5411398e4f4AA26dCdBD7E1Af9C876189BD49c9F`](https://explorer-bradbury.genlayer.com/address/0x5411398e4f4AA26dCdBD7E1Af9C876189BD49c9F) |
| Settlement Router | [`0x645143380d78af86f7528c057c0a1b1ca10f2dd6`](https://explorer-bradbury.genlayer.com/address/0x645143380d78af86f7528c057c0a1b1ca10f2dd6) |
| Router deployment | [`0xb479d38df3c7408b03920ee207239d3101e306f8d99e6ae722d80bb134c421e7`](https://explorer-bradbury.genlayer.com/tx/0xb479d38df3c7408b03920ee207239d3101e306f8d99e6ae722d80bb134c421e7) |
| ClauseFlow deployment | [`0x28f7e7621468ed34eaa9adba8f15045b3d40c9d90f9c8b3efc0e0537b784d7f7`](https://explorer-bradbury.genlayer.com/tx/0x28f7e7621468ed34eaa9adba8f15045b3d40c9d90f9c8b3efc0e0537b784d7f7) |
| Router binding | [`0x44019ddd9f7ec2be24df4c478b0641da0e06a25ef3109b6d2ed3d7feb105ba3d`](https://explorer-bradbury.genlayer.com/tx/0x44019ddd9f7ec2be24df4c478b0641da0e06a25ef3109b6d2ed3d7feb105ba3d) |
| Deployment lifecycle | `FINALIZED / AGREE / FINISHED_WITH_RETURN` |
| ClauseFlow schema | 21 methods: 9 writes and 12 views |
| Initial offer/deal views | `[]` / `[]` |
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
