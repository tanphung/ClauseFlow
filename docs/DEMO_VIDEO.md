# ClauseFlow Demo Video

The reviewer video is generated from the live production app after both pilot agreements reach terminal state.

- Build command: `npm run demo:video`
- Video: `demo-video/ClauseFlow-GenLayer-Demo.mp4`
- Thumbnail: `demo-video/ClauseFlow-Demo-Thumbnail.png`
- Live app: https://clauseflow-two.vercel.app
- Contract: https://explorer-bradbury.genlayer.com/address/0xc56a15E6fE4a94F6d63Af2146A9e566fec933b82
- Settlement Router: https://explorer-bradbury.genlayer.com/address/0xf81ac0031bb35d31252003e8ef2e042941964437

The media directory is intentionally ignored by Git. The final recording must show only state read from the canonical Bradbury contract:

- the `PAID` `0.02 GEN` release-evidence agreement;
- the `REFUNDED` `0.015 GEN` audit non-delivery agreement;
- detailed source, criterion, and deliverable reasoning;
- balance-backed settlement history;
- public party filters and the empty Builder workspace.

The recorder uses the rendered on-chain scores rather than hard-coded demo values. It does not submit writes or fabricate history.
The narration states the validator trust boundary explicitly: the leader prepares a detailed report, protocol-selected validators independently refetch the submitted URLs, and consensus checks material fields rather than accepting matching JSON or prose.
