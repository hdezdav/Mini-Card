const hre = require("hardhat");

// Fee receiver (operator): 0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE
const FEE_RECEIVER = "0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE";

// USDT address per network.
// Mainnet: 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
// Sepolia: 0xd077A400968890Eacc75cdc901F0356c943e4fDb
const USDT_BY_NETWORK = {
  celo: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  celoSepolia: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
};

async function main() {
  const network = hre.network.name;
  let USDT_ADDRESS = USDT_BY_NETWORK[network];

  if (!USDT_ADDRESS) {
    if (network === "hardhat" || network === "localhost") {
      console.log("Local network detected. Deploying MockERC20 for USDT...");
      const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
      const mockUsdt = await MockERC20.deploy("Mock USDT", "USDT");
      await mockUsdt.waitForDeployment();
      USDT_ADDRESS = await mockUsdt.getAddress();
      console.log("  Mock USDT deployed to:", USDT_ADDRESS);
    } else {
      throw new Error(
        `No USDT address configured for network "${network}". ` +
          `Add it to USDT_BY_NETWORK in scripts/deploy-prize.js. ` +
          `Supported networks: ${Object.keys(USDT_BY_NETWORK).join(", ")}.`
      );
    }
  }

  console.log("Deploying MiniCardDailyPrize to", network, "...");
  console.log("  USDT:", USDT_ADDRESS);
  console.log("  Fee receiver:", FEE_RECEIVER);

  const MiniCardDailyPrize = await hre.ethers.getContractFactory("MiniCardDailyPrize");
  const prize = await MiniCardDailyPrize.deploy(USDT_ADDRESS, FEE_RECEIVER);
  await prize.waitForDeployment();

  const prizeAddr = await prize.getAddress();

  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  MiniCardDailyPrize deployed to:", prizeAddr);
  console.log("  Network:", network);
  console.log("  Chain ID:", hre.network.config.chainId || "31337");
  console.log("═══════════════════════════════════════════════════");
  console.log("");

  // Attempt verification if on a live network
  if (network === "celo" || network === "celoSepolia") {
    console.log("Waiting 5 block confirmations before CeloScan verification...");
    const deployTx = prize.deploymentTransaction();
    if (deployTx) {
      await deployTx.wait(5);
    }

    console.log("Verifying MiniCardDailyPrize on CeloScan...");
    try {
      await hre.run("verify:verify", {
        address: prizeAddr,
        constructorArguments: [USDT_ADDRESS, FEE_RECEIVER],
      });
      console.log("Verification succeeded!");
    } catch (err) {
      console.log("Verification failed or skipped:", err.message);
      console.log("You can manually verify with:");
      console.log(
        `  npx hardhat verify --network ${network} ${prizeAddr} ${USDT_ADDRESS} ${FEE_RECEIVER}`
      );
    }
  } else {
    console.log("Skipping CeloScan verification on local network.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });