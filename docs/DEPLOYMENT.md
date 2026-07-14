# ClauseFlow Bradbury Deployment Notes

## Network

- Network: GenLayer Testnet Bradbury
- Chain ID: `4221`
- Explorer: `https://explorer-bradbury.genlayer.com`
- Contract: `0xe25eE0393ebd3DE303D1FeFebA6ce00551C68d3D`
- Deployer: `0xe78def025ce53c9b46ac56cf19f720391119fa5b`

## Deploy

- Command: `genlayer deploy --contract contracts/clauseflow.py`
- Deploy tx: `0x327a4029d7a6a9dc4e2d87b925e545f75091cf918d3ac0bb3cb46d3b0f374c4e`
- Lifecycle/result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Schema: 18 public methods, 9 writes and 9 views
- Basic views verified: `get_deal_ids`, `get_dashboard_stats`

## Payment Smoke

- Offer title: `ClauseFlow verified payment flow`
- Deal ID: `1`
- Amount: `0.02 GEN`
- Fund tx: `0x8dbcb7a1d7a15e8a0f58fd1f6784efb55b227e46750d0c3eb886de61f7f1b8e1`
- Submit tx: `0x5814c635005058ee0aa08437bfaa9ca2dd81243da230c4ef0ce9c1a4f07e7a60`
- Review tx: `0xd6a607db2cfed75f4be0f97736fe3842f5d19a66d82491041612f9bb428be80c`
- Claim tx: `0x7244899ea285fb7843b4c24a8fac0d2939fefa7cc2b8599a72468a9e23dc77df`
- Finalize EVM tx: `0x6d1a3a1824485660ad6cdd181904dc9ab67d2356bbbb13893274a8d712c2b684`
- Confirm tx: `0xc397e1c6ebecfe7f2fef4c2cef7de78681ca34b06e2272e7a51e2a945b727968`
- Final state: `PAID`, with `totalPaidAtto = 20000000000000000`

## Refund Smoke

- Target amount: `0.015 GEN`
- Structured refund draft tx: `0xe3fdc5710b5d0aeaae02360deb2891a8a863cb5f6a47d48bb4333b333025632c`
- Current state: finalized with `FINISHED_WITH_RETURN`.
- Current blocker: `publish_offer` for the refund draft reverts in the Bradbury consensus-main EVM transaction before the contract method executes. Last observed EVM tx: `0x6a83f42f1f6c71b6d0870b78f16e5f160cb1d7e6ff679b9a7b65c5fd9cef87f6`.

## Safety

Private keys stay only in the local `.env` and GenLayer keystore files. The frontend uses only `public/config.js` with public Bradbury address, chain, and explorer settings.
