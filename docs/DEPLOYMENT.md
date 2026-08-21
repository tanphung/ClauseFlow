# ClauseFlow Deployment Proof

## v2 Candidate

The v2 contract pair is deployed and verified. Pilot settlement rows remain pending until both exact receipts reach terminal state.

| Field | Verified value |
| --- | --- |
| Network | GenLayer Testnet Bradbury (`4221`) |
| ClauseFlow v2 | [`0xfa226FED4f2357E0045e09A3fF6F133c721D4567`](https://explorer-bradbury.genlayer.com/address/0xfa226FED4f2357E0045e09A3fF6F133c721D4567) |
| Settlement Router | [`0x2d93c79eb8d050c8328836927808de9cd50b4765`](https://explorer-bradbury.genlayer.com/address/0x2d93c79eb8d050c8328836927808de9cd50b4765) |
| Router deployment | [`0x3c59d3e75409a06d1a23a8a3fe0ebca501567e058ecf45a7525ea2fee6e3817a`](https://explorer-bradbury.genlayer.com/tx/0x3c59d3e75409a06d1a23a8a3fe0ebca501567e058ecf45a7525ea2fee6e3817a) |
| ClauseFlow deployment | [`0x5c49c5289f50afae6b76ccf8bd409a3b83b87e4304514abab278701d5efb1b2c`](https://explorer-bradbury.genlayer.com/tx/0x5c49c5289f50afae6b76ccf8bd409a3b83b87e4304514abab278701d5efb1b2c) |
| Router binding | [`0xa88c04fc0ea3df720f499d551b4610a6cc39b1e738262eac97d03ebf4d5b5501`](https://explorer-bradbury.genlayer.com/tx/0xa88c04fc0ea3df720f499d551b4610a6cc39b1e738262eac97d03ebf4d5b5501) |
| Deployment lifecycle | `FINALIZED / AGREE / FINISHED_WITH_RETURN` |
| ClauseFlow schema | 22 methods: 10 writes and 12 views |
| Initial offer/deal views | `[]` / `[]` |
| Payment agreement | Pending |
| Refund agreement | Pending |
| Final escrow | Pending |

No v2 transaction is claimed successful from lifecycle status alone. Every recorded write must show finalized agreement, `FINISHED_WITH_RETURN`, and its expected refreshed state. Settlement additionally requires the exact router receipt to be released for the correct deal and recipient.

Before this deployment, a funded-message canary finalized transaction [`0x70525d...4b741d`](https://explorer-bradbury.genlayer.com/tx/0x70525d0177611de842a9e967073f682ec891925bdba6d6846244b2e6704b741d). It verified one `0.001 GEN` pure transfer, one zero-value receipt-binding call, an exact Router receipt, recipient release, and zero residual Router balance.

Older test deployments are intentionally excluded from the production runtime and reviewer path. They are not evidence for this release.
