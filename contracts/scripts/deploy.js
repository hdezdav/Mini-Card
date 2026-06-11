const hre = require("hardhat");

async function main() {
  console.log("Deploying MiniCardLeaderboard to", hre.network.name, "...");

  const MiniCardLeaderboard = await hre.ethers.getContractFactory("MiniCardLeaderboard");
  const leaderboard = await MiniCardLeaderboard.deploy();

  await leaderboard.waitForDeployment();

  const address = await leaderboard.getAddress();
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  MiniCardLeaderboard deployed to:", address);
  console.log("  Network:", hre.network.name);
  console.log("  Chain ID:", hre.network.config.chainId);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Copy the address above into web3.ts: LEADERBOARD_CONTRACT_ADDRESS`);
  console.log(`  2. Verify: npx hardhat verify ${address} --network ${hre.network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
