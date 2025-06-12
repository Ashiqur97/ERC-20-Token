const hre = require("hardhat");

async function main() {
    console.log("Deploying EcoToken....");

    const EcoToken = await hre.ethers.getContractFactory("EcoToken");
}