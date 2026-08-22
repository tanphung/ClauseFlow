# ClauseFlow Deployment Proof

## v2 Candidate

The v2 contract pair is deployed and verified. Pilot settlement rows remain pending until both exact receipts reach terminal state.

| Field | Verified value |
| --- | --- |
| Network | GenLayer Testnet Bradbury (`4221`) |
| ClauseFlow v2 | [`0xc56a15E6fE4a94F6d63Af2146A9e566fec933b82`](https://explorer-bradbury.genlayer.com/address/0xc56a15E6fE4a94F6d63Af2146A9e566fec933b82) |
| Settlement Router | [`0xf81ac0031bb35d31252003e8ef2e042941964437`](https://explorer-bradbury.genlayer.com/address/0xf81ac0031bb35d31252003e8ef2e042941964437) |
| Router deployment | [`0xbf4ec30be38d52f1bbe6aa10ca34cd585b0297d7ec229fd6c9126a1c947eef1e`](https://explorer-bradbury.genlayer.com/tx/0xbf4ec30be38d52f1bbe6aa10ca34cd585b0297d7ec229fd6c9126a1c947eef1e) |
| ClauseFlow deployment | [`0x081c67dd5b6aedd4aef006a1f32e88d644548c28fc9bd4db4096a7cb2264e9c5`](https://explorer-bradbury.genlayer.com/tx/0x081c67dd5b6aedd4aef006a1f32e88d644548c28fc9bd4db4096a7cb2264e9c5) |
| Router binding | [`0x7e254d716732d9e6624803f1d23737c9591b4b2974553ba31ed8d2088b089845`](https://explorer-bradbury.genlayer.com/tx/0x7e254d716732d9e6624803f1d23737c9591b4b2974553ba31ed8d2088b089845) |
| Deployment lifecycle | `FINALIZED / AGREE / FINISHED_WITH_RETURN` |
| ClauseFlow schema | 22 methods: 10 writes and 12 views |
| Initial offer/deal views | `[]` / `[]` |
| Payment agreement | Pending |
| Refund agreement | Pending |
| Final escrow | Pending |

No v2 transaction is claimed successful from lifecycle status alone. Every recorded write must show finalized agreement, `FINISHED_WITH_RETURN`, and its expected refreshed state. Settlement additionally requires the exact router receipt to be released for the correct deal and recipient.

Before this deployment, a funded-message canary finalized transaction [`0x70525d...4b741d`](https://explorer-bradbury.genlayer.com/tx/0x70525d0177611de842a9e967073f682ec891925bdba6d6846244b2e6704b741d). It verified one `0.001 GEN` pure transfer, one zero-value receipt-binding call, an exact Router receipt, recipient release, and zero residual Router balance.

Older test deployments are intentionally excluded from the production runtime and reviewer path. They are not evidence for this release.
