// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EcoToken - An Advanced ERC20 token for eco-friendly initiatives with governance and staking
 * @dev This token includes features like tax mechanism, staking rewards, and governance capabilities
 */
contract EcoToken is ERC20, Ownable, ReentrancyGuard {
    
    // Tokenomics
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * (10 ** 18); // 1 billion tokens
    uint256 public constant MAX_SUPPLY = 2_000_000_000 * (10 ** 18); // 2 billion max supply
    uint256 public constant TAX_RATE = 200; // 2% tax rate (2 * 100 for precision)
    uint256 public constant TAX_DIVISOR = 10000; // Divisor for tax calculation
    
    // Staking
    struct Stake {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardRate;
    }
    
    // Vesting
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 amountReleased;
        uint256 startTime;
        uint256 duration;
        uint256 cliff;
    }
    
    mapping(address => Stake) public stakes;
    mapping(address => VestingSchedule) public vestingSchedules;
    
    uint256 public totalStaked;
    uint256 public constant REWARD_RATE = 10; // 10% annual reward rate
    uint256 public constant REWARD_INTERVAL = 365 days;
    
    // Community reward pool
    uint256 public communityRewardPool;
    uint256 public constant REWARD_POOL_ALLOCATION = 100_000_000 * (10 ** 18); // 100M tokens for community rewards
    uint256 public constant REWARD_CLAIM_INTERVAL = 30 days;
    mapping(address => uint256) public lastClaimTime;
    
    // Governance
    struct Proposal {
        uint256 id;
        string description;
        uint256 voteCount;
        uint256 deadline;
        bool executed;
        address proposer;
        mapping(address => bool) hasVoted;
    }
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    uint256 public constant VOTING_DELAY = 1 days;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant PROPOSAL_THRESHOLD = 1000 * (10 ** 18); // 1000 tokens required to propose
    
    // Tax distribution
    address public treasuryWallet;
    address public burnWallet = 0x000000000000000000000000000000000000dEaD;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event TaxCollected(address from, uint256 amount, uint256 burnAmount, uint256 treasuryAmount);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 votes);
    event ProposalExecuted(uint256 indexed proposalId);
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint256 startTime, uint256 duration, uint256 cliff);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event CommunityRewardClaimed(address indexed user, uint256 amount);
    
    // Modifiers
    modifier onlyAfter(uint256 time) {
        require(block.timestamp >= time, "Action not allowed yet");
        _;
    }
    
    modifier onlyBefore(uint256 time) {
        require(block.timestamp < time, "Action no longer allowed");
        _;
    }
    
    /**
     * @dev Constructor that sets up the initial token distribution
     */
    constructor(address _treasuryWallet) 
        ERC20("EcoToken", "ECO")
        Ownable(msg.sender)
    {
        require(_treasuryWallet != address(0), "Invalid treasury address");
        treasuryWallet = _treasuryWallet;
        
        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY - REWARD_POOL_ALLOCATION);
        
        // Initialize community reward pool
        communityRewardPool = REWARD_POOL_ALLOCATION;
        _mint(address(this), REWARD_POOL_ALLOCATION);
    }
    
    /**
     * @dev Override _transfer to implement tax mechanism
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Skip tax for minting, burning, or owner transfers
        if (from == address(0) || to == address(0) || from == owner() || to == owner()) {
            super._update(from, to, amount);
            return;
        }
        
        // Skip if this is a tax transfer
        if (from == burnWallet || to == burnWallet || from == treasuryWallet || to == treasuryWallet) {
            super._update(from, to, amount);
            return;
        }
        
        // Calculate tax
        uint256 taxAmount = (amount * TAX_RATE) / TAX_DIVISOR;
        uint256 burnAmount = taxAmount / 2;
        uint256 treasuryAmount = taxAmount - burnAmount;
        uint256 transferAmount = amount - taxAmount;
        
        // Process tax distribution
        if (burnAmount > 0) {
            super._update(from, burnWallet, burnAmount);
        }
        if (treasuryAmount > 0) {
            super._update(from, treasuryWallet, treasuryAmount);
        }
        
        // Transfer the remaining amount to recipient
        super._update(from, to, transferAmount);
        
        // Emit tax collected event
        emit TaxCollected(from, taxAmount, burnAmount, treasuryAmount);
    }
    
    /**
     * @dev Stake tokens to earn rewards
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0 tokens");
        
        // Claim any existing rewards first
        _claimReward();
        
        // Transfer tokens to this contract
        _transfer(msg.sender, address(this), amount);
        
        // Update stake
        stakes[msg.sender] = Stake({
            amount: stakes[msg.sender].amount + amount,
            timestamp: block.timestamp,
            rewardRate: REWARD_RATE
        });
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake tokens
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0 tokens");
        require(stakes[msg.sender].amount >= amount, "Insufficient staked balance");
        
        // Claim rewards first
        _claimReward();
        
        // Update stake
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
        // Transfer tokens back to user
        _transfer(address(this), msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim staking rewards
     */
    function claimReward() external nonReentrant {
        _claimReward();
    }
    
    /**
     * @dev Internal function to calculate and claim rewards
     */
    function _claimReward() internal {
        uint256 reward = calculateReward(msg.sender);
        if (reward > 0) {
            // Mint new tokens as reward
            _mint(msg.sender, reward);
            stakes[msg.sender].timestamp = block.timestamp;
            emit RewardClaimed(msg.sender, reward);
        }
    }
    
    /**
     * @dev Calculate pending rewards for a staker
     */
    function calculateReward(address user) public view returns (uint256) {
        Stake memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;
        
        uint256 timeStaked = block.timestamp - userStake.timestamp;
        uint256 reward = (userStake.amount * userStake.rewardRate * timeStaked) / (REWARD_INTERVAL * 100);
        return reward;
    }
    
    /**
     * @dev Create a new governance proposal
     */
    function createProposal(string memory description) external {
        require(balanceOf(msg.sender) >= PROPOSAL_THRESHOLD, "Insufficient balance to create proposal");
        
        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.description = description;
        newProposal.voteCount = 0;
        newProposal.deadline = block.timestamp + VOTING_PERIOD;
        newProposal.executed = false;
        newProposal.proposer = msg.sender;
        
        emit ProposalCreated(proposalCount, msg.sender);
    }
    
    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 proposalId, bool support) external {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal ID");
        require(block.timestamp <= proposals[proposalId].deadline, "Voting period has ended");
        require(!proposals[proposalId].hasVoted[msg.sender], "Already voted");
        
        uint256 voterBalance = balanceOf(msg.sender);
        require(voterBalance > 0, "No voting power");
        
        proposals[proposalId].hasVoted[msg.sender] = true;
        
        if (support) {
            proposals[proposalId].voteCount += voterBalance;
        }
        
        emit Voted(proposalId, msg.sender, support, voterBalance);
    }
 
}
