const hre = require("hardhat");

async function main() {
    console.log("Deploying EcoToken....");

    const EcoToken = await hre.ethers.getContractFactory("EcoToken");
    
    const [deployer] = await hre.ethers.getSigners();
    const ecoToken = await EcoToken.deploy(deployer.address);

    await ecoToken.deployed();

 console.log(`EcoToken deployed to: ${ecoToken.address}`);
  console.log(`Total Supply: ${(await ecoToken.totalSupply()).toString()} ECO`);
  console.log(`Owner: ${await ecoToken.owner()}`);
  console.log(`Treasury Wallet: ${await ecoToken.treasuryWallet()}`);
}

main() 
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});