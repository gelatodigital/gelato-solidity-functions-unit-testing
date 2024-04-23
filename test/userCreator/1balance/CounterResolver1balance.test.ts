import { Signer } from "ethers";
import { expect } from "chai";
import hre = require("hardhat");
import {
  impersonateAccount,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
import { AutomateSDK } from "@gelatonetwork/automate-sdk";
import {
  IGelato1Balance,
  IAutomate,
  Counter,
  CounterResolver,
} from "../../../typechain-types";
const { ethers, deployments } = hre;

import {
  getAutomateAddress,
  getGelatoAddress,
  getTreasuryAddress,
} from "../../../hardhat/config/addresses";

const TASK_TREASURY_ADDRESS = getTreasuryAddress("hardhat");
const GELATO_ADDRESS = getGelatoAddress("hardhat");
const AUTOMATE_ADDRESS = getAutomateAddress("hardhat");
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO_ADD = ethers.ZeroAddress;
const FEE = ethers.parseEther("0.1");
const INTERVAL = 180;

describe("UserCreator Gelato Automate Resolver Contract", function () {
  this.timeout(0);

  let deployer: Signer;
  let deployerAddress: string;
  let executor: Signer;

  let oneBalance: IGelato1Balance;
  let automate: IAutomate;
  let counter: Counter;
  let counterResolver: CounterResolver;
  let automateSDK: AutomateSDK;
  let taskId: string;

  before(async function () {
    await deployments.fixture();
    [deployer] = await ethers.getSigners();

    automate = await ethers.getContractAt("IAutomate", AUTOMATE_ADDRESS);
    oneBalance = await ethers.getContractAt("IGelato1Balance", GELATO_ADDRESS);
    console.log(
      "\x1b[32m%s\x1b[0m",
      "    ->",
      `\x1b[30mImpersonating Executor ${GELATO_ADDRESS}`
    );
    await impersonateAccount(GELATO_ADDRESS);
    counter = await ethers.getContractAt("Counter", deployer);
    counterResolver = await ethers.getContractAt("CounterResolver", deployer);
    automateSDK = new AutomateSDK(1, deployer as any);

    const resolverData =
      counterResolver.interface.encodeFunctionData("checker");
  });
});
