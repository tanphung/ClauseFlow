import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { privateKeyToAccount } from "viem/accounts";

function readEnv() {
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
      })
  );
}

function runGenLayer(args) {
  return execSync(["genlayer", ...args].join(" "), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function requireEnv(env, key) {
  if (!env[key]) throw new Error(`Missing .env key: ${key}`);
}

const env = readEnv();
const keys = Object.keys(env).sort();
console.log(`ENV_KEYS=${keys.join(",")}`);

for (const key of ["ACCOUNT_PRIVATE_KEY", "EXPECTED_WALLET_ADDRESS", "CLAUSEFLOW_ACCOUNT_NAME", "CLAUSEFLOW_KEYSTORE_PASSWORD"]) {
  requireEnv(env, key);
}

const deployer = privateKeyToAccount(env.ACCOUNT_PRIVATE_KEY);
if (deployer.address.toLowerCase() !== env.EXPECTED_WALLET_ADDRESS.toLowerCase()) {
  throw new Error(`ACCOUNT_PRIVATE_KEY derives ${deployer.address}, expected ${env.EXPECTED_WALLET_ADDRESS}`);
}
console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
console.log("EXPECTED_WALLET_ADDRESS_MATCH=true");

const networkOutput = runGenLayer(["config", "get", "network"]);
if (!networkOutput.includes("network=testnet-bradbury")) {
  throw new Error(`GenLayer CLI network is not testnet-bradbury:\n${networkOutput}`);
}
console.log("GENLAYER_NETWORK=testnet-bradbury");

const accountOutput = runGenLayer(["account"]);
const activeAddress = accountOutput.match(/address:\s*'([^']+)'/)?.[1] || "";
const balance = accountOutput.match(/balance:\s*'([^']+)'/)?.[1] || "unknown";
const status = accountOutput.match(/status:\s*'([^']+)'/)?.[1] || "unknown";
if (activeAddress.toLowerCase() !== deployer.address.toLowerCase()) {
  throw new Error(`Active GenLayer account ${activeAddress || "unknown"} does not match deployer ${deployer.address}`);
}
console.log(`ACTIVE_ACCOUNT_ADDRESS=${activeAddress}`);
console.log(`ACTIVE_ACCOUNT_BALANCE=${balance}`);
console.log(`ACTIVE_ACCOUNT_STATUS=${status}`);
if (status !== "unlocked") {
  console.log("ACTION_REQUIRED=unlock active GenLayer account before deploy");
}

console.log("PREFLIGHT_OK=true");
