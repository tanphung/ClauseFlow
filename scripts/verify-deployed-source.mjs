import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const expectedHash = "080D204721274D37192043E4E03A20BC477524A400915C5B11D2CD2CD74E74CD";
const source = await readFile(new URL("../contracts/clauseflow.py", import.meta.url), "utf8");
const normalized = source.replace(/\r\n?/g, "\n");
const actualHash = createHash("sha256").update(normalized, "utf8").digest("hex").toUpperCase();

if (actualHash !== expectedHash) {
  console.error(`Deployed source mismatch: expected ${expectedHash}, received ${actualHash}.`);
  process.exitCode = 1;
} else {
  console.log(`Deployed source verified: ${actualHash}`);
}
