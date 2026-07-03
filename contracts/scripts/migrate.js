// Migration script: deploys v2 MiniCardLeaderboard (+ BoosterPack) and migrates
// scores + usernames from the stale v1 contract on Celo mainnet.
//
// Usage:
//   npm run migrate:mainnet
//   NEW_LEADERBOARD_ADDRESS=<v2addr> npm run migrate:mainnet   # resume after a failed run
//
// Env:
//   PRIVATE_KEY                — deployer key (required)
//   CELOSCAN_API_KEY           — for fetching UsernameSet logs (optional, see fallback)
//   MIGRATE_BATCH_SIZE         — scores per migrateScores() tx (default 200)
//   NEW_LEADERBOARD_ADDRESS    — if set, skip deploy and attach to this v2 address
//   BOOSTER_PACK_ADDRESS       — only used when resuming, for printing next steps
//
// ethers v6 is shipped via hardhat-toolbox v5 — use ethers.id(...) (not ethers.utils.id).

require("dotenv").config();
const hre = require("hardhat");

const OLD_LEADERBOARD = "0xfB897EC446b737A99ba8404FCb64821eD2207AeB";
const FEE_RECEIVER = "0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE";
const USDT_ADDRESS = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"; // Celo mainnet USDT
const BATCH_SIZE = Number(process.env.MIGRATE_BATCH_SIZE) || 200;
const USERNAME_BATCH = 100;

// Minimal ABI for reading v1.
const V1_ABI = [
  "function getScoresCount() external view returns (uint256)",
  "function getAllScores() external view returns (tuple(address player, uint256 score, uint256 round, uint256 timestamp)[])",
  "function getUsernames(address[] calldata) external view returns (string[])",
];

function sep() {
  console.log("═══════════════════════════════════════════════════");
}

// Fetch all UsernameSet logs from celoscan and return unique player addresses.
// celoscan caps each response at 1000 logs; we paginate with page/offset.
async function fetchUsernamePlayersFromCeloscan() {
  const apiKey = process.env.CELOSCAN_API_KEY;
  if (!apiKey) {
    console.warn("  [warn] No CELOSCAN_API_KEY — falling back to score-derived address list.");
    return null;
  }

  const { ethers } = hre;
  const topic0 = ethers.id("UsernameSet(address,string)");
  const base = "https://api.celoscan.io/api";
  const players = new Set();
  let page = 1;
  const pageOffset = 1000; // max per call

  // We loop pages until a page returns fewer than pageOffset results.
  while (true) {
    const url =
      `${base}?module=logs&action=getLogs` +
      `&address=${OLD_LEADERBOARD}` +
      `&topic0=${topic0}` +
      `&fromBlock=0&toBlock=latest` +
      `&page=${page}&offset=${pageOffset}` +
      `&apikey=${apiKey}`;
    let json;
    try {
      const res = await fetch(url);
      json = await res.json();
    } catch (err) {
      console.warn("  [warn] celoscan fetch failed:", err.message || err);
      return null;
    }

    if (!json || json.status !== "1" || !Array.isArray(json.result)) {
      // celoscan returns status "0" with message "No records found" when empty.
      if (json && json.message === "No records found") {
        break;
      }
      console.warn("  [warn] celoscan unexpected response:", json && json.message);
      return null;
    }

    const logs = json.result;
    for (const log of logs) {
      // topics[1] is the indexed player address — last 40 hex chars of the 32-byte topic.
      const topic1 = log.topics && log.topics[1];
      if (!topic1) continue;
      const addr = "0x" + topic1.slice(-40);
      players.add(ethers.getAddress(addr));
    }

    if (logs.length < pageOffset) break; // last page
    page++;
    if (page > 50) break; // hard safety cap
  }

  return [...players];
}

// Fallback: derive the player address list from v1 score pages.
// NOTE: this misses username-only users who never submitted a score.
async function fetchUsernamePlayersFromScores(v1) {
  const players = new Set();
  const scores = await v1.getAllScores();
  for (const s of scores) players.add(s.player);
  return [...players];
}

async function main() {
  if (hre.network.name !== "celo") {
    throw new Error("migrate.js is mainnet-only. Use --network celo.");
  }

  const { ethers } = hre;
  const EXISTING_NEW = process.env.NEW_LEADERBOARD_ADDRESS;

  let lb, newAddr, boosterAddr;

  // ─── 1. Deploy (or attach) ───────────────────────────────────────────────
  if (EXISTING_NEW) {
    console.log(`Resuming migration against existing v2 at ${EXISTING_NEW}`);
    lb = await hre.ethers.getContractAt("MiniCardLeaderboard", EXISTING_NEW);
    newAddr = EXISTING_NEW;
    boosterAddr = process.env.BOOSTER_PACK_ADDRESS || null;
    if (!boosterAddr) {
      console.log("  BoosterPack deploy skipped (resume mode). Set BOOSTER_PACK_ADDRESS to print it in next steps.");
    }
  } else {
    console.log("Deploying v2 contracts to", hre.network.name, "...");
    const MiniCardLeaderboard = await hre.ethers.getContractFactory("MiniCardLeaderboard");
    lb = await MiniCardLeaderboard.deploy(OLD_LEADERBOARD);
    await lb.waitForDeployment();
    newAddr = await lb.getAddress();

    const BoosterPack = await hre.ethers.getContractFactory("BoosterPack");
    const booster = await BoosterPack.deploy(USDT_ADDRESS, FEE_RECEIVER);
    await booster.waitForDeployment();
    boosterAddr = await booster.getAddress();
  }

  sep();
  console.log("  MiniCardLeaderboard (v2): ", newAddr);
  console.log("  BoosterPack:              ", boosterAddr || "(skipped)");
  console.log("  Old v1 Leaderboard:       ", OLD_LEADERBOARD);
  sep();

  // Sanity: confirm the v2 was constructed against the right v1.
  const storedOld = await lb.oldLeaderboard();
  if (String(storedOld).toLowerCase() !== OLD_LEADERBOARD.toLowerCase()) {
    throw new Error(`v2 oldLeaderboard mismatch: ${storedOld} vs ${OLD_LEADERBOARD}`);
  }

  // ─── 2. Attach v1 reader ─────────────────────────────────────────────────
  const v1 = await hre.ethers.getContractAt(V1_ABI, OLD_LEADERBOARD);

  // ─── 3. Migrate scores ───────────────────────────────────────────────────
  console.log("");
  console.log("Migrating scores...");
  const total = await v1.getScoresCount();
  console.log(`  v1 scores total: ${total.toString()}`);

  let failures = 0;
  while (true) {
    const cursor = await lb.migratedScoresCursor();
    if (cursor >= total) {
      console.log(`  Scores migration complete (cursor ${cursor} >= total ${total}).`);
      break;
    }
    const end = Math.min(Number(cursor) + BATCH_SIZE, Number(total));
    try {
      const tx = await lb.migrateScores(BATCH_SIZE);
      const rcpt = await tx.wait();
      if (rcpt.status !== 1) throw new Error(`tx reverted (status 0) at cursor ${cursor}`);
      console.log(`  scores: ${cursor} -> ${end}  (tx ${rcpt.hash.slice(0, 10)}...)`);
    } catch (err) {
      failures++;
      console.error(`  [error] migrateScores failed at cursor ${cursor}:`, err.reason || err.shortMessage || err.message);
      console.error(`  Re-run with: NEW_LEADERBOARD_ADDRESS=${newAddr} npm run migrate:mainnet`);
      process.exit(1);
    }
  }

  // ─── 4. Build username player list ───────────────────────────────────────
  console.log("");
  console.log("Building username player list...");
  let players = await fetchUsernamePlayersFromCeloscan();
  if (!players || players.length === 0) {
    console.warn("  [warn] celoscan path returned nothing — falling back to score-derived addresses.");
    console.warn("         Username-only users (no scores) will be missed by this fallback.");
    players = await fetchUsernamePlayersFromScores(v1);
  }
  console.log(`  unique players to migrate: ${players.length}`);
  if (players.length > 0) {
    console.log(`  sample: ${players.slice(0, 5).join(", ")}${players.length > 5 ? ", ..." : ""}`);
  }

  // ─── 5. Migrate usernames in batches ─────────────────────────────────────
  console.log("");
  console.log("Migrating usernames...");
  const lbIface = lb.interface;
  let usernameFailures = 0;
  for (let i = 0; i < players.length; i += USERNAME_BATCH) {
    const chunk = players.slice(i, i + USERNAME_BATCH);
    try {
      const tx = await lb.migrateUsernames(chunk);
      const rcpt = await tx.wait();
      if (rcpt.status !== 1) throw new Error(`tx reverted (status 0) at chunk ${i}`);
      // Decode collision events from receipt logs.
      for (const log of rcpt.logs) {
        try {
          const parsed = lbIface.parseLog(log);
          if (parsed && parsed.name === "MigrationUsernameCollision") {
            console.warn(
              `  [collision] player=${parsed.args.player} name="${parsed.args.name}" ` +
              `existingOwner=${parsed.args.existingOwner} — user must re-register`
            );
          }
        } catch (_) {
          // log from another contract or unrelated topic — ignore
        }
      }
      console.log(`  usernames: chunk ${i}..${i + chunk.length - 1} ok (tx ${rcpt.hash.slice(0, 10)}...)`);
    } catch (err) {
      usernameFailures++;
      console.error(`  [error] migrateUsernames failed at chunk ${i}:`, err.reason || err.shortMessage || err.message);
      // continue to next chunk — partial progress is fine
    }
  }

  // ─── 6. Verify ───────────────────────────────────────────────────────────
  console.log("");
  console.log("Verifying...");
  const v2Count = await lb.getScoresCount();
  const match = v2Count.toString() === total.toString();
  console.log(`  v2 scores count: ${v2Count.toString()}  (v1: ${total.toString()})  ${match ? "MATCH" : "MISMATCH"}`);

  if (players.length > 0) {
    const samples = players.slice(0, 3);
    for (const addr of samples) {
      const name = await lb.usernames(addr);
      const has = await lb.hasUsername(addr);
      console.log(`  sample ${addr}: username="${name}" hasUsername=${has}`);
    }
  }

  // ─── 7. Next steps ───────────────────────────────────────────────────────
  console.log("");
  sep();
  console.log("Next steps");
  sep();
  console.log(`  1. Paste Leaderboard address into apps/web/src/lib/web3.ts line 11:`);
  console.log(`     LEADERBOARD_CONTRACT_ADDRESS = "${newAddr}";`);
  if (boosterAddr) {
    console.log(`  2. Paste BoosterPack address into web3.ts line 117:`);
    console.log(`     BOOSTER_PACK_CONTRACT_ADDRESS = "${boosterAddr}";`);
  }
  console.log(`  3. Verify on celoscan:`);
  console.log(`     npx hardhat verify ${newAddr} ${OLD_LEADERBOARD} --network celo`);
  if (boosterAddr) {
    console.log(`     npx hardhat verify ${boosterAddr} ${USDT_ADDRESS} ${FEE_RECEIVER} --network celo`);
  }
  console.log(`  4. After verifying, call lockMigration() on the v2 contract.`);
  console.log(`  5. If migration failed mid-way, resume with:`);
  console.log(`     NEW_LEADERBOARD_ADDRESS=${newAddr} npm run migrate:mainnet`);
  if (failures > 0 || usernameFailures > 0) {
    console.log(`  [note] score failures: ${failures}, username chunk failures: ${usernameFailures}`);
  }
  sep();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
