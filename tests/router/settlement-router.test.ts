// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserProvider, Contract, ContractFactory, parseEther } from "ethers";
import ganache from "ganache";
import solc from "solc";
import { readFileSync } from "node:fs";

const helperSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IRouter { function release_settlement(string calldata id) external; }
contract RejectingRecipient {
  function release(address router, string calldata id) external { IRouter(router).release_settlement(id); }
  receive() external payable { revert("reject"); }
}`;

function compile() {
  const input = {
    language: "Solidity",
    sources: {
      "SettlementRouter.sol": { content: readFileSync("contracts/SettlementRouter.sol", "utf8") },
      "RejectingRecipient.sol": { content: helperSource }
    },
    settings: {
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((entry: { severity: string }) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry: { formattedMessage: string }) => entry.formattedMessage).join("\n"));
  return output.contracts;
}

const compiled = compile();
const routerArtifact = compiled["SettlementRouter.sol"].ClauseFlowSettlementRouter;
const rejectingArtifact = compiled["RejectingRecipient.sol"].RejectingRecipient;

async function mined(transaction: Promise<unknown>) {
  const response = await transaction as { wait(): Promise<unknown> };
  return response.wait();
}

describe("ClauseFlowSettlementRouter", () => {
  let provider: BrowserProvider;
  let eip1193: ReturnType<typeof ganache.provider>;
  let router: Contract;
  let owner: Awaited<ReturnType<BrowserProvider["getSigner"]>>;
  let clauseFlow: Awaited<ReturnType<BrowserProvider["getSigner"]>>;
  let recipient: Awaited<ReturnType<BrowserProvider["getSigner"]>>;

  beforeEach(async () => {
    eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 6 } });
    provider = new BrowserProvider(eip1193 as never);
    owner = await provider.getSigner(0);
    clauseFlow = await provider.getSigner(1);
    recipient = await provider.getSigner(2);
    const factory = new ContractFactory(routerArtifact.abi, routerArtifact.evm.bytecode.object, owner);
    router = await factory.deploy({ gasLimit: 6_000_000n });
    await router.waitForDeployment();
    await (await router.bind_clauseflow(await clauseFlow.getAddress())).wait();
  });

  afterEach(async () => {
    await eip1193.disconnect();
  });

  it("binds ClauseFlow exactly once", async () => {
    expect(await router.clauseFlow()).toBe(await clauseFlow.getAddress());
    await expect(mined(router.bind_clauseflow(await owner.getAddress()))).rejects.toThrow();
  });

  it("rejects unauthorized funding and duplicate settlement IDs", async () => {
    const id = "CF2|contract|1|1|1|recipient|200";
    await expect(mined(router.fund_settlement(id, "1", await recipient.getAddress(), 1, { value: 200n }))).rejects.toThrow();
    await (await router.connect(clauseFlow).fund_settlement(id, "1", await recipient.getAddress(), 1, { value: 200n })).wait();
    await expect(mined(router.connect(clauseFlow).fund_settlement(id, "1", await recipient.getAddress(), 1, { value: 200n }))).rejects.toThrow();
  });

  it("releases only to the bound recipient and matches every receipt field", async () => {
    const id = "CF2|contract|7|1|1|recipient|0.02";
    const amount = parseEther("0.02");
    const recipientAddress = await recipient.getAddress();
    const sourceAddress = await clauseFlow.getAddress();
    await (await router.connect(clauseFlow).fund_settlement(id, "7", recipientAddress, 1, { value: amount })).wait();
    await expect(mined(router.release_settlement(id))).rejects.toThrow();
    await (await router.connect(recipient).release_settlement(id)).wait();

    expect(await provider.getBalance(await router.getAddress())).toBe(0n);
    expect(await router.matches_released(id, "7", recipientAddress, amount, 1, sourceAddress)).toBe(true);
    expect(await router.matches_released(id, "8", recipientAddress, amount, 1, sourceAddress)).toBe(false);
    expect(await router.matches_released(id, "7", recipientAddress, amount + 1n, 1, sourceAddress)).toBe(false);
    expect(await router.matches_released(id, "7", recipientAddress, amount, 2, sourceAddress)).toBe(false);
    expect(await router.matches_released(id, "7", await owner.getAddress(), amount, 1, sourceAddress)).toBe(false);
    await expect(mined(router.connect(recipient).release_settlement(id))).rejects.toThrow();
  });

  it("keeps funds and FUNDED state when a recipient rejects the release", async () => {
    const rejectingFactory = new ContractFactory(rejectingArtifact.abi, rejectingArtifact.evm.bytecode.object, owner);
    const rejecting = await rejectingFactory.deploy({ gasLimit: 2_000_000n });
    await rejecting.waitForDeployment();
    const id = "CF2|contract|9|1|2|rejecting|500";
    await (await router.connect(clauseFlow).fund_settlement(id, "9", await rejecting.getAddress(), 2, { value: 500n })).wait();
    await expect(mined(rejecting.release(await router.getAddress(), id))).rejects.toThrow();
    const receipt = await router.get_settlement(id);
    expect(receipt[5]).toBe(1n);
    expect(await provider.getBalance(await router.getAddress())).toBe(500n);
  });
});
