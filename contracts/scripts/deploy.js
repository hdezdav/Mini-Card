const hre = require("hardhat");

// Fee receiver (operator): 0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE
const FEE_RECEIVER = "0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE";

// v1 leaderboard on Celo mainnet. The v2 constructor stores this to read
// historical data during migration. On mainnet, migrate.js passes the real v1
// address. On testnet there is no v1, so we pass the zero address — migration
// functions are simply never called there.
const V1_LEADERBOARD_MAINNET = "0xfB897EC446b737A99ba8404FCb64821eD2207AeB";

// USDT address differs per network. Verified against celopedia contracts.md.
// Mainnet: 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
// Sepolia: 0xd077A400968890Eacc75cdc901F0356c943e4fDb
const USDT_BY_NETWORK = {
  celo: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  celoSepolia: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
};

async function main() {
  const network = hre.network.name;
  const USDT_ADDRESS = USDT_BY_NETWORK[network];
  if (!USDT_ADDRESS) {
    throw new Error(
      `No USDT address configured for network "${network}". ` +
        `Add it to USDT_BY_NETWORK in scripts/deploy.js. ` +
        `Supported networks: ${Object.keys(USDT_BY_NETWORK).join(", ")}.`
    );
  }

  console.log("Deploying contracts to", network, "...");
  console.log("  USDT:", USDT_ADDRESS);
  console.log("  Fee receiver:", FEE_RECEIVER);

  // ─── 1. MiniCardLeaderboard ───
  // v2 constructor takes the v1 leaderboard address (for migration reads).
  // On mainnet use the real v1; on testnet there is no v1, so pass zero address.
  const oldLeaderboard =
    network === "celo" ? V1_LEADERBOARD_MAINNET : hre.ethers.ZeroAddress;
  const MiniCardLeaderboard = await hre.ethers.getContractFactory("MiniCardLeaderboard");
  const leaderboard = await MiniCardLeaderboard.deploy(oldLeaderboard);
  await leaderboard.waitForDeployment();
  const leaderboardAddr = await leaderboard.getAddress();

  // ─── 2. BoosterPack ───
  const BoosterPack = await hre.ethers.getContractFactory("BoosterPack");
  const booster = await BoosterPack.deploy(USDT_ADDRESS, FEE_RECEIVER);
  await booster.waitForDeployment();
  const boosterAddr = await booster.getAddress();

  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  MiniCardLeaderboard deployed to:", leaderboardAddr);
  console.log("  BoosterPack deployed to:        ", boosterAddr);
  console.log("  Network:", hre.network.name);
  console.log("  Chain ID:", hre.network.config.chainId);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Copy Leaderboard address into web3.ts: LEADERBOARD_CONTRACT_ADDRESS`);
  console.log(`  2. Copy BoosterPack address into web3.ts: BOOSTER_PACK_CONTRACT_ADDRESS`);
  console.log(`  3. Verify Leaderboard: npx hardhat verify ${leaderboardAddr} --network ${hre.network.name}`);
  console.log(`  4. Verify BoosterPack:  npx hardhat verify ${boosterAddr} ${USDT_ADDRESS} ${FEE_RECEIVER} --network ${hre.network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
