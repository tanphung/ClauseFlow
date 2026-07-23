# ClauseFlow Release Evidence Dossier

## Purpose

This dossier is a public, versioned delivery artifact for ClauseFlow agreements. It gives Bradbury validators a concrete evidence map for evaluating a real release: a usable public application, the deployed intelligent-contract source, and the repository documentation that describes the same product.

## Release Artifacts

| Artifact | Public source | What a validator can verify |
| --- | --- | --- |
| Live application | https://clauseflow-two.vercel.app | A usable ClauseFlow dashboard with public agreement history, deal detail, evidence review, and settlement states. |
| Intelligent contract | https://raw.githubusercontent.com/tanphung/ClauseFlow/main/contracts/clauseflow.py | Immutable agreement storage, exact GEN escrow, evidence review, deterministic settlement eligibility, and public history views. |
| Frontend source | https://github.com/tanphung/ClauseFlow/tree/main/src | The React UI calls Bradbury contract views and shows transaction lifecycle and execution results. |
| Repository README | https://raw.githubusercontent.com/tanphung/ClauseFlow/main/README.md | Reviewer setup, the two-party on-chain workflow, validation model, and test commands. |

## Validator Checklist

1. Fetch the live application and confirm that the Dashboard, Offers, Create, and Deal Detail views render.
2. Fetch `contracts/clauseflow.py` and confirm public methods for offer publication, exact-value funding, delivery submission, evidence review, payment, refund, and public history.
3. Fetch the README and confirm the same agreement lifecycle: Builder publishes, Client locks exact GEN, Builder submits public evidence, validators decide, and the eligible party settles escrow.
4. Confirm that the frontend and contract source are linked from the public repository and describe ClauseFlow rather than unrelated work.
5. Treat an accessible URL as insufficient by itself: the observed UI, contract methods, and written lifecycle must materially match the accepted agreement terms.

## Deterministic Settlement Boundaries

- A Builder cannot claim payment until the validator result is `APPROVED`.
- A Client cannot refund an active deal except after a rejected review or deterministic deadline/revision eligibility.
- Payment and refund claims enter pending states, and terminal `PAID` or `REFUNDED` requires escrow-balance confirmation.
- Public history views retain the accepted terms, submitted evidence, review report, timestamps, parties, and settlement result for each deal.

## Local Reproduction

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run lint:contract
py -3.13 -m pytest tests/direct -q
```

The browser uses the public Bradbury address from `public/config.js`; keys remain local in `.env` and are never needed to inspect the public Dashboard.
