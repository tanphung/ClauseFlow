# ClauseFlow Three-Minute Demo

The produced reviewer video and upload copy are documented in [`DEMO_VIDEO.md`](DEMO_VIDEO.md). Run `npm run demo:video` to regenerate it from the current production app without creating new transactions.

## Before Recording

- Open the public ClauseFlow URL and the Bradbury explorer.
- Use only real, publicly accessible ClauseFlow release evidence. Never use `example.com`, placeholder content, or fabricated customer claims.

## Demo Flow

1. **Dashboard**
   Reload production. Show the bundled, contract-bound snapshot immediately, then the status transition to `Live on-chain data synced`. Point out the two terminal agreements and balance-backed totals.

2. **Paid agreement**
   Open `ClauseFlow v2 immutable enforcement dossier`, show the four immutable obligations, then the full validator report. Explain that the leader creates the detailed report while protocol-selected validators independently refetch every URL and verify version binding, all obligation IDs, findings, reasoning, score, missing items, and settlement decision. Point at individual Finding and Validator reasoning fields before showing the exact Builder receipt and `PAID 0.02 GEN` timeline.

3. **Refunded agreement**
   Open `ClauseFlow v2 accessibility audit non-delivery`. Show the `REJECTED 0/100` report for both accepted audit obligations, the missing `AUDIT` evidence type, exact Client receipt, and the `REFUNDED 0.015 GEN` timeline with zero active escrow.

4. **Discovery and workspace**
   Demonstrate public title and address filters. Open the empty Create workspace, then the accepted published offer terms. Do not connect a wallet or submit a transaction during recording.

5. **Close**
   Identify the history honestly as a two-wallet Bradbury pilot and show the production and GitHub reviewer links.

## Recording Rules

- Do not hide failed states or indexing delays; explain how the UI resolves them.
- Do not call a transaction successful from `ACCEPTED` or `FINALIZED` alone. Show the execution result and refreshed contract state.
- Do not use fabricated delivery URLs, placeholder agreements, or prefilled demo text.
