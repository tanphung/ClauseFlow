# ClauseFlow Bradbury Deployment Proof

## Canonical Deployment

- Network: GenLayer Testnet Bradbury
- Chain ID: `4221`
- Contract: `0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D`
- Deployer: `0xe78def025cE53c9b46ac56cF19f720391119fa5b`
- EVM activation: `0x7e52f5e0462e30322ef3fec4c65dfe2f65c3ce3fd98482a0b0220801a3c4c3bb`
- GenLayer deployment: `0x3e2ad3fd2f4c980dc5d481d253e072b501a0508206a3f6c91245e2dc538e5737`
- Result: `FINALIZED / AGREE / FINISHED_WITH_RETURN`
- Schema: 18 methods, 9 writes and 9 views
- Initial final view: `get_offer_ids=[]`
- Normalized source SHA-256: `080D204721274D37192043E4E03A20BC477524A400915C5B11D2CD2CD74E74CD`

## Pilot Settlement Proof

Every transaction below reached `AGREE / FINISHED_WITH_RETURN`; terminal state was then re-read from contract views. Explorer links expose lifecycle and receipt details independently.

### Agreement 1: paid release dossier

| Action | GenLayer transaction | Resulting state |
| --- | --- | --- |
| Structure clauses | [`0x2e9816...b3b61`](https://explorer-bradbury.genlayer.com/tx/0x2e9816744a0f60260da3d7c51415bede72ac36c8a1e6089559b218ed8c7b3b61) | structured draft |
| Publish offer | [`0xedc80e...0ace5`](https://explorer-bradbury.genlayer.com/tx/0xedc80e294b0345f3d633d55b14866d2bd18477ec21bff7456df55d362020ace5) | offer `#1` |
| Fund exact `0.02 GEN` | [`0x011010...9b7e8`](https://explorer-bradbury.genlayer.com/tx/0x011010520426af3c2868755e6809cbbada9b485fe3274e6050d20fd1fc29b7e8) | deal `#1`, `FUNDED` |
| Submit public evidence | [`0xde90d9...fa157`](https://explorer-bradbury.genlayer.com/tx/0xde90d923f83b33ee6bf7d1017eb8d381019c83f02b5bec1a0dd69995049fa157) | `SUBMITTED` |
| Validator review | [`0xca08a0...f7208d`](https://explorer-bradbury.genlayer.com/tx/0xca08a0099fdd4344e52a98b491fb6e2979bc9e7ff85243d656c1187a5af7208d) | `APPROVED`, `100/100` |
| Claim Builder payment | [`0x4ed08c...6447a`](https://explorer-bradbury.genlayer.com/tx/0x4ed08cf096bcd3bb01a796f2bec6e53404469b895aa3bcec7b6963035776447a) | finalized `0.02 GEN` transfer |
| Confirm balance change | [`0x3a772a...01847`](https://explorer-bradbury.genlayer.com/tx/0x3a772aad45b1a36671e6586bde729fe8eb52d37c0eaa9b733f957319adc01847) | `PAID` |

The stored report says all four public sources were fetched, all four criteria and all four deliverables were `SATISFIED`, and the deterministic score was `100`.

### Agreement 2: refunded audit non-delivery

| Action | GenLayer transaction | Resulting state |
| --- | --- | --- |
| Structure clauses | [`0xfbd49e...465c5`](https://explorer-bradbury.genlayer.com/tx/0xfbd49ebd66427d2d06bdda454ebea00c9f7751fa9179a86d06538d20e8a465c5) | structured draft |
| Publish offer | [`0xf45d11...0f0b9`](https://explorer-bradbury.genlayer.com/tx/0xf45d1102e5c8d079455c7e13b40c9326653fc362ef8643e1eca23b597d40f0b9) | offer `#2` |
| Fund exact `0.015 GEN` | [`0x922399...105ab`](https://explorer-bradbury.genlayer.com/tx/0x92239940f6c51142b829b0dae7ae09991903b8f100a18772efd1ec93a04105ab) | deal `#2`, `FUNDED` |
| Submit non-delivery record | [`0xb24a1b...c1447`](https://explorer-bradbury.genlayer.com/tx/0xb24a1bd01b51c30bb8e0678a8fb8db0319fc8082d8ba151c001a882aaa5c1447) | `SUBMITTED` |
| Validator review | [`0x2d78a3...aaf63`](https://explorer-bradbury.genlayer.com/tx/0x2d78a3ce224185fdbb5c2f11905a34ba2c088ae870fa2dd94c3b74c67a6aaf63) | `REJECTED`, `0/100` |
| Claim Client refund | [`0x747606...260b`](https://explorer-bradbury.genlayer.com/tx/0x7476065018a564ae6577a42d92b9edf0ddb2a196dfaeafa65b9554ddba17260b) | finalized `0.015 GEN` transfer |
| Confirm balance change | [`0x75d385...106e6`](https://explorer-bradbury.genlayer.com/tx/0x75d38546246d68bdad51df417150583d2caefd932ce7220e1812404c159106e6) | `REFUNDED` |

The stored report explicitly identifies the absent dedicated audit and its missing keyboard, focus, measured-contrast, and remediation findings. General app/source/README pages were not accepted as substitutes.

Verified terminal totals from `get_dashboard_stats`:

| Metric | Verified |
| --- | ---: |
| Offers | `2` |
| Deals | `2` |
| Completed | `2` |
| Funded | `0.035 GEN` |
| Paid | `0.02 GEN` |
| Refunded | `0.015 GEN` |
| Active/accounted escrow | `0 GEN` |
| Contract balance | `0 GEN` |

## Verification Commands

```powershell
npm audit --omit=dev
npm run lint:contract
py -3.13 -m pytest tests/direct -q
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run preflight:bradbury
genlayer code 0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D
genlayer schema 0xF85C4460B8195F9ebFD7b376c852aD7E89Ffe63D
```

Private keys remain local in `.env` and are never included in this proof.
