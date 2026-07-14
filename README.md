# ClauseFlow

ClauseFlow is a two-party service agreement dApp on GenLayer. Builders publish precise work offers, Clients fund them with GEN, and the Intelligent Contract evaluates public delivery evidence before allowing payment or refund. The public Dashboard reads the complete agreement and settlement history from on-chain views.

## Why GenLayer

ClauseFlow does not attach consensus to generic AI output. Offer structuring is deterministic and contract-owned. Validator consensus is used only at the settlement-critical boundary where subjective evidence must be checked against accepted clauses.

During `review_delivery`, every validator can independently:

1. fetch the submitted delivery, demo, documentation, and GitHub URLs;
2. compare the fetched content with the funded scope, deliverables, and acceptance criteria;
3. derive `APPROVED`, `REVISION_REQUIRED`, or `REJECTED`;
4. compare material result fields, evidence accessibility, score thresholds, and criteria coverage.

The outcome changes who can receive escrowed GEN, which is why this decision belongs in a GenLayer Intelligent Contract instead of an off-chain AI service.

## Lifecycle

```mermaid
flowchart LR
  A[Builder structures offer] --> B[Builder publishes offer]
  B --> C[Client funds exact GEN amount]
  C --> D[Builder submits public evidence]
  D --> E[Validators fetch and review evidence]
  E -->|Approved| F[Builder claims payment]
  E -->|Revision required| D
  E -->|Rejected| G[Client claims refund]
  F --> H[Transfer finalized and payment confirmed]
  G --> I[Transfer finalized and refund confirmed]
  H --> J[Public Dashboard history]
  I --> J
```

Deadline, grace period, revision exhaustion, refund eligibility, escrow accounting, and idempotency are deterministic contract rules.

## Bradbury Deployment

- Network: Testnet Bradbury, chain ID `4221`
- Contract: `0xe25eE0393ebd3DE303D1FeFebA6ce00551C68d3D`
- Deploy transaction: `0x327a4029d7a6a9dc4e2d87b925e545f75091cf918d3ac0bb3cb46d3b0f374c4e`
- Deploy result: `ACCEPTED / AGREE / FINISHED_WITH_RETURN`
- Explorer: [contract](https://explorer-bradbury.genlayer.com/address/0xe25eE0393ebd3DE303D1FeFebA6ce00551C68d3D)

The deployed schema exposes 9 write methods and 9 public views. `get_deal_ids` and `get_dashboard_stats` were successfully read after deployment.

Current Bradbury smoke state:

- Payment deal: `ClauseFlow verified payment flow`, deal `1`, funded with `0.02 GEN`
- Payment claim tx: `0x7244899ea285fb7843b4c24a8fac0d2939fefa7cc2b8599a72468a9e23dc77df`, finalized with `FINISHED_WITH_RETURN`
- Payment confirm tx: `0xc397e1c6ebecfe7f2fef4c2cef7de78681ca34b06e2272e7a51e2a945b727968`, accepted with `FINISHED_WITH_RETURN`
- Dashboard state: deal `1` is `PAID`; `totalPaidAtto` is `20000000000000000`
- Refund smoke: structured refund draft tx `0xe3fdc5710b5d0aeaae02360deb2891a8a863cb5f6a47d48bb4333b333025632c` is accepted and waiting for Bradbury finalization before publishing/funding the refund-path deal.

## Contract API

Contract source: [`contracts/clauseflow.py`](contracts/clauseflow.py)

Writes:

- `structure_offer`
- `publish_offer`
- `accept_offer` (payable, exact amount)
- `submit_delivery`
- `review_delivery`
- `claim_payment` / `confirm_payment`
- `claim_refund` / `confirm_refund`

Views:

- `get_offer_ids` / `get_offer`
- `get_deal_ids` / `get_deal`
- `get_completed_deal_ids`
- `get_deals_for_address`
- `get_deal_history`
- `get_dashboard_stats`
- `get_structured_offer`

The two-step settlement state reflects GenLayer external-message semantics: a claim emits the GEN transfer and records a pending state; confirmation marks `PAID` or `REFUNDED` only after the contract balance proves that escrow left the contract. Repeated settlement is rejected.

## Dashboard

The React app has no mock agreement fallback. It reads canonical offers, deals, aggregate totals, and per-deal timelines from the configured Bradbury contract.

- Public totals for offers, funded/active/completed deals, paid GEN, and refunded GEN
- Builder, Client, and title/address filters
- Full agreement detail with accepted clauses and delivery evidence
- Lifecycle timeline from funding through review and settlement
- Transaction hash, explorer link, consensus result, execution result, and child transfer IDs
- Explicit loading, empty, indexing-delay, and failure states

Runtime public configuration is in [`public/config.js`](public/config.js). Private keys must stay only in local `.env` or encrypted GenLayer keystores.

## Local Development

Requires Node.js 22+, Python 3.13 for direct tests on Windows, GenLayer CLI, `genvm-lint`, and `gltest`.

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173` while the dev server is running.

## Verification

```powershell
npm audit
npm test
npm run typecheck
npm run build
genvm-lint check contracts/clauseflow.py --json
py -3.13 -m pytest tests/direct/ -q
npm run test:e2e
```

Current local verification:

- GenVM lint: 18 methods validated
- Direct contract tests: 5 passed
- Frontend unit tests: 4 passed
- Production dependency audit: 0 vulnerabilities
- TypeScript typecheck and production build: passed
- Browser E2E suite: desktop and mobile coverage

The direct-test fixture includes a Windows-only stdin cleanup workaround for a `gltest` temporary-file lock; it does not change contract behavior.

## Deployment Safety

`.env`, keystores, private keys, build artifacts, test output, and caches are excluded by `.gitignore`. The frontend receives only public chain configuration. Before any deployment, the local deployer address is checked against `EXPECTED_WALLET_ADDRESS` without printing secret values.

Official references:

- [GenLayer value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)
- [GenLayer messages](https://docs.genlayer.com/developers/intelligent-contracts/features/messages)
- [genlayer-js contract API](https://docs.genlayer.com/api-references/genlayer-js/contracts)

## Submission

Full source repository: [github.com/tanphung/ClauseFlow](https://github.com/tanphung/ClauseFlow)

Project submission remains paused until GenLayer reopens the queue. The repository and live app currently demonstrate a complete paid agreement on the public Dashboard. The refund-path smoke is in progress and should be completed before final reward submission.
