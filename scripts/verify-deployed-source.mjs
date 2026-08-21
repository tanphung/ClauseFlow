import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const deployedContract = "0x5411398e4f4AA26dCdBD7E1Af9C876189BD49c9F";
const expectedHash = "CAB932FE7C3953FFC1C9CB55BA0ED05972D25901CC71D1D71A6BC2FAF4269EE9";
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
