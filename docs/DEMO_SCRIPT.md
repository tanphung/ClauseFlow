# ClauseFlow Three-Minute Demo

The produced reviewer video and upload copy are documented in [`DEMO_VIDEO.md`](DEMO_VIDEO.md). Run `npm run demo:video` to regenerate it from the current production app without creating new transactions.

## Before Recording

- Open the public ClauseFlow URL and the Bradbury explorer.
- Use two test wallets, one Builder and one Client.
- Keep the offer below `0.5 GEN`.
- Use only real, publicly accessible evidence. The verified example uses Mochi-Game, not `example.com` or placeholder content.

## Demo Flow

1. **Dashboard, 20 seconds**
   Show that totals and agreement rows load from the Bradbury contract. Open paid deal `1` and point out the accepted clauses, evidence package, validator findings, payment transaction, and lifecycle timeline.

2. **Create an offer, 40 seconds**
   As the Builder, enter a concrete request for a real public project. Structure the clauses, review every generated section, and publish only after the scope, deliverables, acceptance criteria, evidence requirements, deadline, revisions, payment, and refund terms are specific.

3. **Fund the agreement, 30 seconds**
   Switch to the Client wallet, accept the offer, and lock the exact GEN amount. Show the pending transaction, consensus state, execution result, and refreshed `FUNDED` deal state.

4. **Submit and review evidence, 50 seconds**
   Switch back to the Builder. Submit the real live URL, demo URL, docs URL, and repository URL. Trigger review and show that validators fetch those sources and return criteria-level findings rather than validating JSON format alone.

5. **Settle and verify, 30 seconds**
   Claim the eligible payment or refund, then confirm settlement after the transfer finalizes. Show that a second settlement is rejected and the Dashboard amount changes only after contract state confirms the transfer.

6. **Close, 10 seconds**
   Filter the Dashboard by Builder and Client addresses. Explain that the public history is canonical on-chain data and that validator consensus controls a real escrow outcome.

## Recording Rules

- Do not hide failed states or indexing delays; explain how the UI resolves them.
- Do not call a transaction successful from `ACCEPTED` or `FINALIZED` alone. Show the execution result and refreshed contract state.
- Do not use fabricated delivery URLs, placeholder agreements, or prefilled demo text.
