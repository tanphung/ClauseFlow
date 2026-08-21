import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const deployedContract = "0xfa226FED4f2357E0045e09A3fF6F133c721D4567";
const expectedHash = "154196B09A12FE84B78C3BE06A2E355685E08C59E423CE6BC5E8BF087D251110";
const source = await readFile(new URL("../contracts/clauseflow.py", import.meta.url), "utf8");
const runtimeConfig = await readFile(new URL("../public/config.js", import.meta.url), "utf8");
const normalized = source.replace(/\r\n?/g, "\n");
const actualHash = createHash("sha256").update(normalized, "utf8").digest("hex").toUpperCase();

if (!runtimeConfig.includes(deployedContract)) {
  console.error(`Runtime config does not target the source-verified v2 contract ${deployedContract}.`);
  process.exitCode = 1;
} else if (actualHash !== expectedHash) {
  console.error(`Deployed source mismatch: expected ${expectedHash}, received ${actualHash}.`);
  process.exitCode = 1;
} else {
  console.log(`Deployed source verified: contract=${deployedContract} sha256=${actualHash}`);
}
