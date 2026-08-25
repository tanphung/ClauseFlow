# ClauseFlow Deployment Proof

## Final v2 Release

The v2 contract pair and both two-wallet pilot settlements are finalized and verified.

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
| Payment agreement | Deal `#1`, `PAID`, 0.02 GEN, validator score 100 |
| Refund agreement | Deal `#2`, `REFUNDED`, 0.015 GEN, validator score 0 |
| Final escrow | `0` accounted, `0` contract balance, `0` pending settlements |

No v2 transaction is claimed successful from lifecycle status alone. Every recorded write shows finalized agreement, `FINISHED_WITH_RETURN`, and its expected refreshed state. Settlement additionally requires the exact router receipt to be released for the correct deal and recipient.

## Pilot Transactions

| Stage | Payment deal `#1` | Refund deal `#2` |
| --- | --- | --- |
| Funding | [`0xc7d439...d7680b`](https://explorer-bradbury.genlayer.com/tx/0xc7d4399db6e9decb1b3eb3cc08ca2a4127e86242171c402f673f5813d1d7680b) | [`0xef4377...e67fd9`](https://explorer-bradbury.genlayer.com/tx/0xef4377c0e202fa22fdfb76f72313405b38f18a50b39d19878c2fef2cf8e67fd9) |
| Immutable evidence | [`0xf5f279...915d26`](https://explorer-bradbury.genlayer.com/tx/0xf5f279512cd2bb0d95a595bc476b2b870499a2680bd6f013d8cf165edd915d26) | [`0x2763cc...52a776`](https://explorer-bradbury.genlayer.com/tx/0x2763cc8f1e2cec320410171ca280eb8074f25c0def3d83e81ba9d9ecfa52a776) |
| Validator review | [`0xb104c0...abbce4`](https://explorer-bradbury.genlayer.com/tx/0xb104c0c4b505b0de13bbb3d8bca15814395e63f43debf5a5fa8a1715b2abbce4) | [`0x5180d1...346d5b`](https://explorer-bradbury.genlayer.com/tx/0x5180d1c879d7f12681ec77c0b6cdbde38e717cf09fdb3bc4378fd4dfa4346d5b) |
| Settlement claim | [`0x6bcc5d...e0926a`](https://explorer-bradbury.genlayer.com/tx/0x6bcc5da27198d6a1a27db8bda4a0f9233ebaffac94bf3a554d29997effe0926a) | [`0x85838c...3e7ce6`](https://explorer-bradbury.genlayer.com/tx/0x85838c88fd24fb52ffdc1dae1d7fdbb04c29735df61674f611ba4cddd43e7ce6) |
| Router release | `0x3179930e6006e63a8304e63308ac6d067086f5a287350f2c2d950ab272949ed7` | `0xd877c0c41e12ad316b06dd76b638aaefdeaba901fc25d48e186a899dc9be281f` |
| Terminal confirmation | [`0x11b9d4...d645e5`](https://explorer-bradbury.genlayer.com/tx/0x11b9d45ac686bb6c9cb3f3ba09750d8a9817c3538b8ef704121176b0e7d645e5) | [`0xd68603...918e30`](https://explorer-bradbury.genlayer.com/tx/0xd6860343e86928c70d1eecceacba4277e022cfa865119ca9dfc8537dba918e30) |

Final `get_dashboard_stats` reports `2` offers, `2` deals, `2` completed, `35000000000000000` attoGEN funded, `20000000000000000` paid, `15000000000000000` refunded, and zero active escrow, contract balance, or pending settlements.

Before this deployment, a funded-message canary finalized transaction [`0x70525d...4b741d`](https://explorer-bradbury.genlayer.com/tx/0x70525d0177611de842a9e967073f682ec891925bdba6d6846244b2e6704b741d). It verified one `0.001 GEN` pure transfer, one zero-value receipt-binding call, an exact Router receipt, recipient release, and zero residual Router balance.

Older test deployments are intentionally excluded from the production runtime and reviewer path. They are not evidence for this release.
