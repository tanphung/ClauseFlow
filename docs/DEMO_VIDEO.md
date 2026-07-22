# ClauseFlow Submission Video

## Deliverables

- Video: `demo-video/ClauseFlow-GenLayer-Demo.mp4`
- Thumbnail: `demo-video/ClauseFlow-Demo-Thumbnail.png`
- Duration: 2 minutes 25 seconds
- Format: H.264 MP4, 1920x1080, 30 fps, AAC stereo
- Build command: `npm run demo:video`

The generated media directory is intentionally ignored by Git. Upload the final MP4 to YouTube, Google Drive, or the submission platform, then place the public video URL in `docs/SUBMISSION.md`.

## Suggested Title

ClauseFlow: Verifiable Service Agreements and GEN Escrow on GenLayer

## Suggested Description

ClauseFlow is a two-party service agreement dApp on GenLayer Bradbury. Builders publish objective terms, Clients lock exact GEN escrow, and validators fetch public delivery evidence before the contract permits payment or refund.

This demo uses the live production app and the final deployed contract. It shows a verified `PAID` agreement for `0.02 GEN`, a verified `REFUNDED` agreement for `0.015 GEN`, criteria-level validator findings, canonical lifecycle history, public party filters, and the empty Builder workspace.

- Live app: https://clauseflow-two.vercel.app
- Source: https://github.com/tanphung/ClauseFlow
- Contract: https://explorer-bradbury.genlayer.com/address/0x993D37D07e31d8e3853B8702919f4d805299B124

## Chapters

- `0:00` ClauseFlow and the trust problem
- `0:04` Public Bradbury dashboard
- `0:26` Approved evidence and Builder payment
- `0:58` Rejected evidence and Client refund
- `1:28` Public agreement and party filters
- `1:45` Empty Builder workspace and published clauses
- `2:08` Review links and closing summary

## Recording Integrity

The recording does not submit new transactions, use placeholder URLs, or fabricate agreement history. It reads the final Bradbury contract and demonstrates the two already-finalized settlement outcomes. The Create view remains empty; no sample form is presented as a real transaction.
