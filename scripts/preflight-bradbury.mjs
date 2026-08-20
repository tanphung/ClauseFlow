import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { testnetBradbury } from "genlayer-js/chains";

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

for (const key of ["EXPECTED_WALLET_ADDRESS"]) {
  requireEnv(env, key);
}

const deployerKey = env.ACCOUNT1_PRIVATE_KEY || env.ACCOUNT_PRIVATE_KEY;
if (!deployerKey) throw new Error("Missing .env key: ACCOUNT1_PRIVATE_KEY");
const deployer = privateKeyToAccount(deployerKey);
if (deployer.address.toLowerCase() !== env.EXPECTED_WALLET_ADDRESS.toLowerCase()) {
  throw new Error(`ACCOUNT_PRIVATE_KEY derives ${deployer.address}, expected ${env.EXPECTED_WALLET_ADDRESS}`);
}
console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
console.log("EXPECTED_WALLET_ADDRESS_MATCH=true");

const builderKey = env.CLAUSEFLOW_BUILDER_PRIVATE_KEY || env.ClauseFlow2_PRIVATE_KEY;
const clientKey = env.CLAUSEFLOW_CLIENT_PRIVATE_KEY || env.ClauseFlow3_PRIVATE_KEY;
if (!/^0x[a-fA-F0-9]{64}$/.test(builderKey || "")) throw new Error("Missing valid Builder private key");
if (!/^0x[a-fA-F0-9]{64}$/.test(clientKey || "")) throw new Error("Missing valid Client private key");
const builder = privateKeyToAccount(builderKey);
const client = privateKeyToAccount(clientKey);
if (new Set([deployer.address, builder.address, client.address].map((address) => address.toLowerCase())).size !== 3) {
  throw new Error("Deployer, Builder and Client must be three distinct wallets");
}
const expectedBuilder = env.EXPECTED_BUILDER_WALLET_ADDRESS || env.ClauseFlow2_ADDRESS;
const expectedClient = env.EXPECTED_CLIENT_WALLET_ADDRESS || env.ClauseFlow3_ADDRESS;
if (expectedBuilder && builder.address.toLowerCase() !== expectedBuilder.toLowerCase()) throw new Error("Builder key/address mismatch");
if (expectedClient && client.address.toLowerCase() !== expectedClient.toLowerCase()) throw new Error("Client key/address mismatch");
const publicClient = createPublicClient({ chain: testnetBradbury, transport: http(undefined, { timeout: 30_000, retryCount: 1 }) });
const [deployerBalance, builderBalance, clientBalance] = await Promise.all([
  publicClient.getBalance({ address: deployer.address }),
  publicClient.getBalance({ address: builder.address }),
  publicClient.getBalance({ address: client.address })
]);
console.log(`BUILDER_ADDRESS=${builder.address}`);
console.log(`CLIENT_ADDRESS=${client.address}`);
console.log(`DEPLOYER_BALANCE=${formatEther(deployerBalance)} GEN`);
console.log(`BUILDER_BALANCE=${formatEther(builderBalance)} GEN`);
console.log(`CLIENT_BALANCE=${formatEther(clientBalance)} GEN`);
if (deployerBalance < 100_000_000_000_000_000n) throw new Error("Deployer needs at least 0.1 GEN");
if (builderBalance < 50_000_000_000_000_000n) throw new Error("Builder needs at least 0.05 GEN for transaction fees");
if (clientBalance < 100_000_000_000_000_000n) throw new Error("Client needs at least 0.1 GEN for escrow and fees");

const networkOutput = runGenLayer(["config", "get", "network"]);
if (!networkOutput.includes("network=testnet-bradbury")) {
  throw new Error(`GenLayer CLI network is not testnet-bradbury:\n${networkOutput}`);
}
console.log("GENLAYER_NETWORK=testnet-bradbury");

const accountOutput = runGenLayer(["account"]);
const activeAddress = accountOutput.match(/address:\s*'([^']+)'/)?.[1] || "";
const balance = accountOutput.match(/balance:\s*'([^']+)'/)?.[1] || "unknown";
const status = accountOutput.match(/status:\s*'([^']+)'/)?.[1] || "unknown";
console.log(`ACTIVE_ACCOUNT_ADDRESS=${activeAddress}`);
console.log(`ACTIVE_ACCOUNT_BALANCE=${balance}`);
console.log(`ACTIVE_ACCOUNT_STATUS=${status}`);
console.log(`CLI_ACTIVE_MATCHES_DIRECT_DEPLOYER=${activeAddress.toLowerCase() === deployer.address.toLowerCase()}`);
if (status !== "unlocked") console.log("CLI_KEYSTORE_LOCKED=true; direct deployment can still use ACCOUNT1_PRIVATE_KEY without changing the OS keychain");

console.log("PREFLIGHT_OK=true");
