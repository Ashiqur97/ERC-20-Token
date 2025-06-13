const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("EcoToken", function () {
  let EcoToken, ecoToken, owner, addr1, addr2, treasuryWallet;
  const initialSupply = ethers.utils.parseEther("1000000000"); // 1 billion tokens
  const REWARD_POOL_ALLOCATION = ethers.utils.parseEther("100000000"); // 100M tokens
  const TAX_RATE = 200; // 2%

  beforeEach(async function() {
    [owner,addr1,addr2,treasuryWallet] = await ethers.getSigners();

    const EcoTokenFactory = await ethers.getContractFactory("EcoToken");
  })

});