const hre = require("hardhat");

async function main() {
  const address = "0xfB897EC446b737A99ba8404FCb64821eD2207AeB";
  const abi = [
    "function getScoresCount() external view returns (uint256)",
    "function getAllScores() external view returns (tuple(address player, uint256 score, uint256 round, uint256 timestamp)[])"
  ];
  
  const leaderboard = await hre.ethers.getContractAt(abi, address);
  
  try {
    const count = await leaderboard.getScoresCount();
    console.log("=========================================");
    console.log("Scores Count:", count.toString());
    
    const scores = await leaderboard.getAllScores();
    console.log("All Scores:", scores);
    console.log("=========================================");
  } catch (err) {
    console.error("Failed to query contract:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
