import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const accounts: string[] = PRIVATE_KEY ? [PRIVATE_KEY] : [];
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://rpc.arb-blueberry.gelato.digital`,
        // blockNumber: 13400000
      },
    },

    // Shared Testnet
    blueberry: {
      accounts,
      chainId: 88153591557,
      url: `https://rpc.arb-blueberry.gelato.digital`,
    },
    raspberry: {
      accounts,
      chainId: 123420111,
      url: `https://rpc.opcelestia-raspberry.gelato.digital`,
    },
    blackberry: {
      accounts,
      chainId: 94204209,
      url: `https://rpc.polygon-blackberry.gelato.digital`,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.20",
      },
    ],
  },
};

export default config;
