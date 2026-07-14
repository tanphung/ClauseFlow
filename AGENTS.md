# GenLayer Bradbury dApp Build and Deploy Instructions

Use this file as the project-level `AGENTS.md` when building or deploying GenLayer dApps to Testnet Bradbury. It is intentionally generic: do not assume the dApp domain, frontend stack, contract behavior, account, or deployment target until the user specifies it.

Current reference date: 2026-07-08.

## Source of Truth

Prefer official GenLayer documentation over local notes, memory, old examples, or copied code:

- GenLayer docs home: https://docs.genlayer.com/
- Networks overview: https://docs.genlayer.com/developers/networks
- Network configuration: https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration
- CLI deployment: https://docs.genlayer.com/developers/intelligent-contracts/deploying/cli-deployment
- GenLayer CLI reference: https://docs.genlayer.com/api-references/genlayer-cli
- GenLayerJS reference: https://docs.genlayer.com/api-references/genlayer-js
- GenLayerPY reference: https://docs.genlayer.com/api-references/genlayer-py
- First contract guide: https://docs.genlayer.com/developers/intelligent-contracts/first-contract
- Equivalence Principle: https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle
- Development setup and skills: https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup
- GenLayer test reference: https://docs.genlayer.com/api-references/genlayer-test

If this file conflicts with official docs, follow the official docs and report the conflict before continuing.

Never invent GenLayer APIs, decorators, storage types, CLI flags, SDK imports, chain names, RPC methods, receipt fields, or transaction status names.

Do not use `genlayernode` unless the user explicitly asks for validator node setup.

## Required Codex Skills

For GenLayer work, use these skills when available:

- `genlayer-dapp`: generic GenLayer dApp workflow.
- `genlayer-dev:write-contract`: write or review Python Intelligent Contracts.
- `genlayer-dev:genvm-lint`: run and fix GenVM lint issues.
- `genlayer-dev:direct-tests`: write and run direct-mode tests.
- `genlayer-dev:integration-tests`: write and run integration tests.
- `genlayer-dev:genlayer-cli`: deploy, inspect receipts, read schema/code, debug transactions.

When unsure about a command or API, read official docs or use docs/MCP before coding.

## Bradbury Network Rules

Testnet Bradbury is the production-like testnet for real AI/LLM workloads.

Use Bradbury only when the user has confirmed real testnet deployment or testing. Bradbury is persistent and transactions consume test GEN.

Use the official CLI network selector:

```powershell
genlayer network testnet-bradbury
genlayer config get network
genlayer account
```

Expected Bradbury identifiers:

- CLI network: `testnet-bradbury`
- GenLayerJS chain: `testnetBradbury` from `genlayer-js/chains`
- GenLayerPY chain: `testnet_bradbury`
- Chain ID: `4221`
- Currency: `GEN`
- Explorer: https://explorer-bradbury.genlayer.com/
- Faucet: https://testnet-faucet.genlayer.foundation/

Before deploy or writes:

- Verify the active CLI network is Bradbury.
- Verify the deployer account and balance.
- Verify the wallet is on chain ID `4221`.
- Verify frontend contract addresses belong to Bradbury.
- Do not silently fall back to Studionet, Localnet, Asimov, or a stale address.
- Never put private keys in frontend env vars, `VITE_*`, source files, screenshots, logs, commits, or deployment artifacts.

## Contract File Rules

For deployable Python Intelligent Contracts:

- The runner dependency header must be the first line of the file.
- Use a pinned concrete runner version. Do not use `py-genlayer:test`, `py-genlayer:latest`, or unversioned `py-genlayer`.
- Use `from genlayer import *` unless official docs or the installed GenLayer skill says otherwise.
- Have exactly one deployable contract class in the file.
- The contract class must extend `gl.Contract`.
- Public read methods use `@gl.public.view`.
- Public write methods use `@gl.public.write`.
- Payable writes use `@gl.public.write.payable`.
- `__init__` is not decorated as public.

Recommended single-file header:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
```

Recommended class shape:

```python
class Contract(gl.Contract):
    owner: Address

    def __init__(self):
        self.owner = gl.message.sender_address
```

Use the class name `Contract` when possible for maximum tooling compatibility, unless the existing repo has a working convention.

## Storage and ABI Rules

Persistent fields must be declared in the class body with type annotations. Fields created only by assigning `self.field = ...` without a class-level annotation are not persistent.

Use GenLayer storage and numeric types:

- `DynArray[T]` instead of Python `list[T]`.
- `TreeMap[K, V]` instead of Python `dict[K, V]`.
- `u8` through `u256` or `i8` through `i256` for sized integers.
- `u256` for token amounts.
- Integer basis points for percentages.
- Atto-denominated GEN values for money: `1 GEN = 10**18 attoGEN`.

Avoid in public ABI and persistent storage unless official docs confirm support:

- Python `dict`
- Python `list`
- bare `TreeMap` or bare `DynArray`
- `Optional[T]`
- `Union[T]`
- unsupported custom classes
- floats for financial values

Do not reassign persistent `TreeMap` or `DynArray` fields in `__init__`:

```python
# Wrong
self.items = TreeMap()
self.rows = DynArray()
```

GenVM initializes top-level storage collections. Set scalar initial values only.

## Non-Deterministic and AI Logic

GenLayer is valuable when validators must reach consensus on an external, subjective, AI-mediated, or web-derived decision that affects on-chain state, escrow, payout, access, reputation, or settlement.

Do not use GenLayer as a generic AI backend if no validator-verifiable state transition is needed.

Never call `gl.nondet.*` directly from deterministic code. Use the Equivalence Principle:

- `gl.eq_principle.strict_eq(...)` for deterministic or canonicalized outputs.
- `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` when validators need custom independent verification.
- `gl.eq_principle.prompt_comparative(...)` or `prompt_non_comparative(...)` only when appropriate and documented.

For LLM/web adjudication:

- Return structured JSON with fixed fields.
- Use enums and bounded scores.
- Normalize casing, whitespace, ordering, and numeric ranges.
- Compare material fields, not full free-form explanations.
- Use score tolerance only when justified.
- Treat web/API unavailability explicitly.
- Do not let validators approve a leader result merely because it is well-formed JSON.

The validator must verify substance. It should independently rerun, independently derive, or judge the leader output against the same evidence and rubric.

No side effects inside leader or validator callbacks:

- no storage writes;
- no status changes;
- no counter increments;
- no GEN transfers;
- no emitted contract messages;
- no nested nondeterministic execution.

Perform state changes only after consensus returns successfully.

## Contract Error Handling

Design contract methods so expected external failure paths produce controlled state, not VM crashes.

For AI/web review flows:

- If evidence cannot be rendered or parsed, prefer a controlled `REJECTED`/failure state with a reason when that matches the product logic.
- Do not let malformed LLM output crash settlement if the app can safely reject or retry.
- Sanitize and validate all LLM JSON.
- Use explicit failure categories in prompts and validator logic.

Do not mask real contract bugs. If a deterministic invariant fails, raise a clear user error and fix the bug.

## Deployment Workflow

Run this order before any Bradbury deploy:

1. Inspect project structure and existing scripts.
2. Read/update contract using current GenLayer patterns.
3. Run GenVM lint:

```powershell
genvm-lint check contracts/<contract>.py --json
```

4. Run direct tests:

```powershell
pytest tests/direct/ -v
```

5. Run integration tests if configured:

```powershell
gltest tests/integration/ -v -s --network studionet
```

6. Build/typecheck frontend if contract integration changed:

```powershell
cd frontend
npm test -- --run
npm run build
```

7. Confirm Bradbury deployment intent with the user.
8. Set and verify Bradbury:

```powershell
genlayer network testnet-bradbury
genlayer config get network
genlayer account
```

9. Verify the account has enough test GEN.
10. Deploy:

```powershell
genlayer deploy --contract contracts/<contract>.py
```

If constructor args are needed:

```powershell
genlayer deploy --contract contracts/<contract>.py --args "arg1" 42
```

11. Capture the deployment transaction hash and contract address from the deployment output or receipt.
12. Inspect receipt execution result. Do not treat lifecycle status alone as success.
13. Verify deployed schema:

```powershell
genlayer schema <contract_address>
```

14. Verify deployed source if needed:

```powershell
genlayer code <contract_address>
```

15. Call a basic view:

```powershell
genlayer call <contract_address> <view_method>
```

16. Update frontend env/config only after the deploy transaction execution succeeded and schema/view calls work.

## Transaction Success Rules

On GenLayer, `ACCEPTED` or `FINALIZED` does not automatically mean contract execution succeeded. A transaction can finalize with execution error and no state changes.

Always check execution result fields such as:

- `tx_execution_result_name`
- `txExecutionResultName`
- `FINISHED_WITH_RETURN`
- `FINISHED_WITH_ERROR`

Treat success as:

```text
status is ACCEPTED or FINALIZED
AND execution result is FINISHED_WITH_RETURN
AND expected state/schema/view result is observable
```

Treat failure as:

```text
ACCEPTED or FINALIZED with FINISHED_WITH_ERROR
missing state change after sufficient indexing time
no contract code/schema after a failed deploy
```

For debugging:

```powershell
genlayer receipt <tx_hash> --stdout --stderr
genlayer schema <contract_address>
genlayer code <contract_address>
genlayer call <contract_address> <view_method>
```

If using GenLayerPY, official docs recommend checking `tx_execution_result_name` before reading state and using `debug_trace_transaction` for execution traces.

## Value Transfers and Child Transactions

GEN transfers and cross-contract writes may create child transactions. A parent transaction may succeed while a child transfer or message fails.

When the product claims payout, compensation, or escrow movement:

- Track parent transaction hash.
- Track child transaction IDs when available.
- Check child transaction execution results.
- Do not show "Payment completed" until the relevant child execution succeeds.
- Make settlement idempotent.
- Set settlement locks before emitting payments.
- Prefer finalized execution for irreversible payout messages when the contract design requires finality.

## Frontend Integration Rules

For GenLayerJS frontends:

- Import Bradbury from official SDK chain exports:

```ts
import { testnetBradbury } from "genlayer-js/chains";
```

- Keep contract addresses in explicit config such as `.env`, but never private keys.
- Use typed wrappers for read/write methods.
- Use the same network and contract address in frontend, deploy scripts, and tests.
- Display transaction links per user action.
- Display contract links separately and clearly.
- Do not show `Accepted` as final success unless execution result is successful.
- If explorer/indexer is still loading, show a pending/indexing state instead of fake success.
- Persist useful transaction history in local storage if the UI needs to survive reloads.

Recommended frontend env shape:

```text
VITE_SIGNALSTAKE_CONTRACT_ADDRESS=<bradbury_contract_address>
VITE_SIGNALSTAKE_CHAIN=bradbury
VITE_GENLAYER_EXPLORER=https://explorer-bradbury.genlayer.com
```

Never include:

```text
PRIVATE_KEY=...
DEPLOYER_PRIVATE_KEY=...
SIGNER_PRIVATE_KEY=...
```

in frontend env files or `VITE_*` variables.

## Common Bradbury Problems to Avoid

### Wrong network

Symptoms:

- deploy succeeds somewhere but frontend reads empty state;
- schema not found;
- wallet signs on a different chain;
- Studionet or Asimov address is used on Bradbury.

Fix:

- Run `genlayer network testnet-bradbury`.
- Run `genlayer config get network`.
- Verify chain ID `4221` in wallet.
- Verify explorer links point to `explorer-bradbury.genlayer.com`.

### Dependency header not first

Symptoms:

- lint/deploy parser error;
- runner not found;
- unexpected VM/runtime error.

Fix:

- Put the `# { "Depends": ... }` header on line 1.
- Remove BOM, blank line, license comment, or encoding comment before it.

### Storage collection reassignment

Symptoms:

- storage type assertion errors;
- `TreeMap <- TreeMap`;
- collections lose data or fail validation.

Fix:

- Declare collections as class fields.
- Do not call `TreeMap()` or `DynArray()` in `__init__`.

### Public ABI uses unsupported types

Symptoms:

- schema extraction fails;
- frontend encoding fails;
- deploy or write transaction reverts/errors.

Fix:

- Use strings, booleans, bytes, Address, sized integers, and supported storage/return types.
- Avoid Python `dict`, `list`, `Optional`, `Union`, bare generics, and floats for money.

### LLM/web consensus disagreement

Symptoms:

- review transactions become accepted/finalized with errors;
- consensus rotates repeatedly;
- no state update after AI review.

Fix:

- Use structured JSON.
- Compare stable decision fields.
- Normalize variable data.
- Avoid exact comparison of free-form reasoning.
- Add controlled rejection for unavailable evidence.

### Frontend reports fake success

Symptoms:

- dApp shows `Accepted` but explorer shows error;
- spinner never stops;
- state does not update after transaction.

Fix:

- Check execution result, not just lifecycle status.
- Stop spinner on `FINISHED_WITH_ERROR`.
- Show `Failed` with a transaction link.
- Re-read state after success.
- If state is not indexed yet, show "accepted, waiting for index/state" rather than final success.

## Required Final Report After Deployment

Never say "deployed successfully" unless all of these are available:

- exact deployment command;
- selected network;
- deployer address;
- deployment transaction hash;
- transaction lifecycle status;
- execution result, preferably `FINISHED_WITH_RETURN`;
- decoded contract address;
- successful `genlayer schema <address>` result;
- successful basic view call result;
- frontend config file updated with the real address, if applicable;
- child transaction results if payout/messages were emitted;
- explorer link.

If any of these are missing, say:

```text
NOT FULLY VERIFIED - deployment/state still needs verification.
```

If no deployment was performed, say:

```text
NOT DEPLOYED - ready for user deployment.
```

## Minimal Bradbury Checklist

- [ ] Used `genlayer-dapp` and relevant `genlayer-dev:*` skills.
- [ ] Checked official docs for uncertain APIs/commands.
- [ ] Contract dependency header is line 1.
- [ ] Runner version is pinned.
- [ ] Exactly one contract class extends `gl.Contract`.
- [ ] Decorators are correct.
- [ ] Persistent fields are class-level annotations.
- [ ] No unsupported storage/public ABI types.
- [ ] No collection reassignment in `__init__`.
- [ ] Money uses `u256` attoGEN.
- [ ] Nondeterministic calls use the Equivalence Principle.
- [ ] Validator checks material fields, not only JSON shape.
- [ ] No side effects inside nondeterministic callbacks.
- [ ] LLM/web failure paths are controlled.
- [ ] `genvm-lint check` passes.
- [ ] Direct tests pass.
- [ ] Integration tests pass or skipped with a clear reason.
- [ ] Frontend tests/build pass if frontend changed.
- [ ] CLI network is `testnet-bradbury`.
- [ ] Deployer has test GEN.
- [ ] Receipt execution result is checked.
- [ ] Schema and view calls work after deploy.
- [ ] Frontend uses the verified Bradbury contract address.
