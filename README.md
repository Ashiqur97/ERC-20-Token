# EcoToken - ERC20 Token Project

A simple and user-friendly ERC20 token implementation using Solidity and Hardhat. This token is designed for eco-friendly initiatives and rewards.

## Features
- ERC20 compliant token with 18 decimal places
- 1 billion initial supply
- Minting functionality (owner only)
- Burning functionality (any token holder)
- Simple and secure implementation

## Prerequisites
- Node.js (v14 or later)
- npm or yarn

## Installation
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Compile Contract
```bash
npx hardhat compile
```

## Deploy to Local Network
1. Start a local Hardhat node in a separate terminal:
   ```bash
   npx hardhat node
   ```

2. In a new terminal, deploy the contract:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

## Contract Details
- **Name**: EcoToken
- **Symbol**: ECO
- **Initial Supply**: 1,000,000,000 ECO (1 billion)
- **Decimals**: 18

## Testing
Run the test suite with:
```bash
npx hardhat test
```

## License
MIT
