const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EcoToken", function () {
  let EcoToken, ecoToken, owner, addr1, addr2, treasuryWallet;
  const initialSupply = ethers.utils.parseEther("1000000000"); // 1 billion tokens
  const REWARD_POOL_ALLOCATION = ethers.utils.parseEther("100000000"); // 100M tokens
  const TAX_RATE = 200; // 2%

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner, addr1, addr2, treasuryWallet] = await ethers.getSigners();
    
    // Deploy the contract with treasury wallet
    const EcoTokenFactory = await ethers.getContractFactory("EcoToken");
    ecoToken = await EcoTokenFactory.deploy(treasuryWallet.address);
    await ecoToken.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await ecoToken.owner()).to.equal(owner.address);
    });

    it("Should assign the initial supply to the owner minus reward pool", async function () {
      const ownerBalance = await ecoToken.balanceOf(owner.address);
      const expectedBalance = initialSupply.sub(REWARD_POOL_ALLOCATION);
      expect(ownerBalance).to.equal(expectedBalance);
    });

    it("Should allocate reward pool to the contract", async function () {
      const contractBalance = await ecoToken.balanceOf(ecoToken.address);
      expect(contractBalance).to.equal(REWARD_POOL_ALLOCATION);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts with tax", async function () {
      // Get initial balances
      const initialBurnBalance = await ecoToken.balanceOf(await ecoToken.burnWallet());
      const initialTreasuryBalance = await ecoToken.balanceOf(treasuryWallet.address);
      const initialOwnerBalance = await ecoToken.balanceOf(owner.address);
      
      // Transfer 50 tokens from owner to addr1
      const transferAmount = ethers.utils.parseEther("50");
      
      // Expected tax calculation: 2% of 50 = 1 token total tax (0.5 to burn, 0.5 to treasury)
      const expectedTaxAmount = transferAmount.mul(TAX_RATE).div(10000);
      const expectedBurnAmount = expectedTaxAmount.div(2);
      const expectedTreasuryAmount = expectedTaxAmount.sub(expectedBurnAmount);
      const expectedTransferAmount = transferAmount.sub(expectedTaxAmount);
      
      // Perform the transfer and wait for the transaction to be mined
      const tx = await ecoToken.transfer(addr1.address, transferAmount);
      const receipt = await tx.wait();
      
      // Get final balances
      const finalAddr1Balance = await ecoToken.balanceOf(addr1.address);
      const finalBurnBalance = await ecoToken.balanceOf(await ecoToken.burnWallet());
      const finalTreasuryBalance = await ecoToken.balanceOf(treasuryWallet.address);
      const finalOwnerBalance = await ecoToken.balanceOf(owner.address);
      
      // Calculate actual changes
      const actualBurnAmount = finalBurnBalance.sub(initialBurnBalance);
      const actualTreasuryAmount = finalTreasuryBalance.sub(initialTreasuryBalance);
      const actualTaxAmount = actualBurnAmount.add(actualTreasuryAmount);
      
      // Log debug information
      console.log('=== Transfer Details ===');
      console.log('Transfer amount:', ethers.utils.formatEther(transferAmount), 'tokens');
      console.log('Expected tax:', ethers.utils.formatEther(expectedTaxAmount), 'tokens');
      console.log('Actual tax:', ethers.utils.formatEther(actualTaxAmount), 'tokens');
      console.log('Expected burn:', ethers.utils.formatEther(expectedBurnAmount), 'tokens');
      console.log('Actual burn:', ethers.utils.formatEther(actualBurnAmount), 'tokens');
      console.log('Expected treasury:', ethers.utils.formatEther(expectedTreasuryAmount), 'tokens');
      console.log('Actual treasury:', ethers.utils.formatEther(actualTreasuryAmount), 'tokens');
      
      // Check debug events
      const debugEvents = receipt.events?.filter(x => x.event === 'DebugTaxCalculation');
      if (debugEvents && debugEvents.length > 0) {
        const debugData = debugEvents[0].args;
        console.log('\n=== Debug Event Data ===');
        console.log('From:', debugData.from);
        console.log('To:', debugData.to);
        console.log('Amount:', debugData.amount.toString());
        console.log('Calculated tax:', debugData.taxAmount.toString());
        console.log('Burn amount:', debugData.burnAmount.toString());
        console.log('Treasury amount:', debugData.treasuryAmount.toString());
        console.log('Transfer amount:', debugData.transferAmount.toString());
      }
      
      // Basic transfer verification
      // Recipient should receive the amount minus tax (50 - 1 = 49 tokens)
      expect(finalAddr1Balance.toString()).to.equal(
        expectedTransferAmount.toString(), 
        'Recipient should receive amount minus tax'
      );
      
      // Owner should be debited the full transfer amount (50 tokens)
      expect(initialOwnerBalance.sub(finalOwnerBalance).toString()).to.equal(
        transferAmount.toString(), 
        'Owner should be debited the full transfer amount'
      );
      
      // Verify the difference is the tax amount
      expect(transferAmount.sub(finalAddr1Balance).toString()).to.equal(
        expectedTaxAmount.toString(),
        'Difference should equal the tax amount'
      );
      
      // Check if tax was applied correctly
      if (actualTaxAmount.gt(0)) {
        console.log('\nTax was applied successfully!');
        expect(actualBurnAmount).to.equal(expectedBurnAmount, 'Incorrect burn amount');
        expect(actualTreasuryAmount).to.equal(expectedTreasuryAmount, 'Incorrect treasury amount');
      } else {
        console.warn('\nWARNING: No tax was applied to the transfer');
        // This will make the test fail but continue execution
        expect.fail('No tax was applied to the transfer');
      }
    });

    it("Should not tax transfers to/from treasury or burn wallet", async function () {
      // Fund the treasury wallet first
      const fundAmount = ethers.utils.parseEther("1000");
      await ecoToken.transfer(treasuryWallet.address, fundAmount);
      
      // Transfer from treasury to another address (no tax expected)
      const transferAmount = ethers.utils.parseEther("100");
      await ecoToken.connect(treasuryWallet).transfer(addr1.address, transferAmount);
      
      // Check if full amount was transferred (no tax)
      const addr1Balance = await ecoToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(transferAmount);
      
      // Check treasury balance was reduced by exactly transferAmount
      const newTreasuryBalance = await ecoToken.balanceOf(treasuryWallet.address);
      expect(newTreasuryBalance).to.equal(fundAmount.sub(transferAmount));
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      // Try to send 1 token from addr1 (0 tokens) to owner
      await expect(
        ecoToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20InsufficientBalance");
    });
  });
  
  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      // First, transfer some tokens to addr1 (accounting for tax)
      const transferAmount = ethers.utils.parseEther("1000");
      await ecoToken.transfer(addr1.address, transferAmount);
      
      // Calculate expected amount after tax (2% of 1000 = 20, so 980 received)
      const taxAmount = transferAmount.mul(TAX_RATE).div(10000); // 20 tokens
      const receivedAmount = transferAmount.sub(taxAmount); // 980 tokens
      
      // Approve and stake 100 tokens
      const stakeAmount = ethers.utils.parseEther("100");
      
      // Approve the staking contract to spend tokens
      await ecoToken.connect(addr1).approve(ecoToken.address, stakeAmount);
      
      // Get initial balances
      const initialStakingBalance = await ecoToken.balanceOf(ecoToken.address);
      const initialAddr1Balance = await ecoToken.balanceOf(addr1.address);
      
      // Stake the tokens
      await ecoToken.connect(addr1).stake(stakeAmount);
      
      // Check staked amount (should be the full amount, no tax on staking)
      const stakeInfo = await ecoToken.stakes(addr1.address);
      expect(stakeInfo.amount.toString()).to.equal(
        stakeAmount.toString(),
        'Staked amount should equal the requested amount'
      );
      
      // Check token balances
      const finalAddr1Balance = await ecoToken.balanceOf(addr1.address);
      const expectedFinalBalance = initialAddr1Balance.sub(stakeAmount);
      
      // Verify addr1's balance was reduced by the staked amount
      expect(finalAddr1Balance.toString()).to.equal(
        expectedFinalBalance.toString(),
        'Incorrect balance after staking'
      );
      
      // Verify staking contract received the staked amount
      const finalStakingBalance = await ecoToken.balanceOf(ecoToken.address);
      const stakingBalanceChange = finalStakingBalance.sub(initialStakingBalance);
      
      expect(stakingBalanceChange.toString()).to.equal(
        stakeAmount.toString(),
        'Staking contract should receive the full staked amount'
      );
      
      // Verify total staked amount matches
      expect(await ecoToken.totalStaked()).to.equal(stakeAmount);
    });
  });
  
  describe("Governance", function () {
    it("Should allow creating proposals with sufficient balance", async function () {
      // Transfer tokens to addr1 to meet proposal threshold (accounting for tax)
      const transferAmount = ethers.utils.parseEther("2000"); // Send extra to cover tax
      await ecoToken.transfer(addr1.address, transferAmount);
      
      // Verify addr1 has enough tokens after tax (2% of 2000 = 40, so 1960 received)
      const taxAmount = transferAmount.mul(TAX_RATE).div(10000);
      const receivedAmount = transferAmount.sub(taxAmount);
      expect(await ecoToken.balanceOf(addr1.address)).to.equal(receivedAmount);
      
      // Create a proposal
      const description = "Test proposal";
      await ecoToken.connect(addr1).createProposal(description);
      
      // Get the proposal ID from the event
      const proposalCreatedFilter = ecoToken.filters.ProposalCreated();
      const proposalEvents = await ecoToken.queryFilter(proposalCreatedFilter);
      const proposalId = proposalEvents[0].args.proposalId;
      
      // Get the proposal details
      const proposal = await ecoToken.proposals(proposalId);
      
      // Check proposal was created with correct values
      expect(proposal.description).to.equal(description);
      expect(proposal.voteCount).to.equal(0);
      expect(proposal.proposer).to.equal(addr1.address);
      expect(proposal.id).to.equal(proposalId);
      expect(proposal.executed).to.be.false;
    });
    
    it("Should not allow creating proposals without sufficient balance", async function () {
      // Transfer just below threshold to addr2 (1000 tokens - 2% tax = 980 received)
      const belowThreshold = ethers.utils.parseEther("1000");
      await ecoToken.transfer(addr2.address, belowThreshold);
      
      // Verify balance is below threshold after tax
      const taxAmount = belowThreshold.mul(TAX_RATE).div(10000);
      const receivedAmount = belowThreshold.sub(taxAmount);
      const balance = await ecoToken.balanceOf(addr2.address);
      expect(balance).to.equal(receivedAmount);
      expect(balance).to.be.lt(ethers.utils.parseEther("1000"));
      
      // Try to create a proposal with insufficient balance
      const description = "Should fail proposal";
      await expect(
        ecoToken.connect(addr2).createProposal(description)
      ).to.be.revertedWith("Insufficient balance to create proposal");
    });
  });
});
