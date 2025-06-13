require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

const ALCHEMY_SEPOLIA_URL = process.env.ALCHEMY_SEPOLIA_URL || "";
const ALCHEMY_SEPOLIA_PRIVATE_KEY = process.env.ALCHEMY_SEPOLIA_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    },
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL,
      accounts: ALCHEMY_SEPOLIA_PRIVATE_KEY ? [ALCHEMY_SEPOLIA_PRIVATE_KEY] : []
    }
  },
  mocha: {
    timeout: 40000
  }
};
