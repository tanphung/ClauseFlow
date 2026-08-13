# ClauseFlow Three-Minute Demo

The produced reviewer video and upload copy are documented in [`DEMO_VIDEO.md`](DEMO_VIDEO.md). Run `npm run demo:video` to regenerate it from the current production app without creating new transactions.

## Before Recording

- Open the public ClauseFlow URL and the Bradbury explorer.
- Use two test wallets, one Builder and one Client.
- Keep the offer below `0.5 GEN`.
- Use only real, publicly accessible ClauseFlow release evidence. Never use `example.com`, placeholder content, or fabricated customer claims.

## Demo Flow

1. **Dashboard**
   Reload production with browser cache available. Show the verified snapshot immediately, then the status transition to `Live on-chain data synced`. Point out the two terminal agreements and balance-backed totals.

2. **Paid agreement**
   Open `ClauseFlow release evidence dossier`, show immutable terms, then the full validator report. Explain that the leader creates the detailed report while protocol-selected validators independently refetch every URL and verify accessibility, criteria, deliverables, missing items, score, and settlement decision. Point at individual Finding and Validator reasoning fields before showing the `PAID 0.02 GEN` timeline.

3. **Refunded agreement**
   Open `ClauseFlow accessibility audit agreement`. Show the `REJECTED 0/100` report, failed criteria, missing dedicated audit deliverable, and the `REFUNDED 0.015 GEN` timeline with zero active escrow.

4. **Discovery and workspace**
   Demonstrate public title and address filters. Open the empty Create workspace, then the accepted published offer terms. Do not connect a wallet or submit a transaction during recording.

5. **Close**
   Identify the history honestly as a two-wallet Bradbury pilot and show the production and GitHub reviewer links.

## Recording Rules

- Do not hide failed states or indexing delays; explain how the UI resolves them.
- Do not call a transaction successful from `ACCEPTED` or `FINALIZED` alone. Show the execution result and refreshed contract state.
- Do not use fabricated delivery URLs, placeholder agreements, or prefilled demo text.
