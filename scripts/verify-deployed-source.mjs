import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const deployedContract = "0xc56a15E6fE4a94F6d63Af2146A9e566fec933b82";
const expectedHash = "70C2925ED86B6E0F482F47532DB2E5549841764ECE952B8E782BB57F99CFC80F";
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
