const hre = require("hardhat");

async function main() {
  const address = "0xfB897EC446b737A99ba8404FCb64821eD2207AeB";
  const code = await hre.ethers.provider.getCode(address);
  console.log("=========================================");
  console.log("Contract Address:", address);
  console.log("Bytecode length:", code.length);
  if (code === "0x") {
    console.log("No contract deployed at this address!");
  } else {
    console.log("Contract exists!");
  }
  console.log("=========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
