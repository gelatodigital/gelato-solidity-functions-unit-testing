import { Signer } from "ethers";
import { expect } from "chai";
import hre = require("hardhat");
import {
  impersonateAccount,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
import { Module, ModuleData, encodeResolverArgs, getTaskId } from "../../utils";
import { AutomateSDK, TriggerType } from "@gelatonetwork/automate-sdk";
import {
  IGelato1Balance,
  IAutomate,
  Counter,
  CounterResolver,
  CounterWT,
  ResolverModule,
  ProxyModule,
} from "../../../typechain-types";

const { ethers, deployments } = hre;

import { getGelatoAddress } from "../../../hardhat/config/addresses";

const GELATO_ADDRESS = getGelatoAddress("hardhat");
const AUTOMATE_ADDRESS = "0x2A6C106ae13B558BB9E2Ec64Bd2f1f7BEFF3A5E0";
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
  let resolverModule: ResolverModule;
  let counter: Counter;
  let counterResolver: CounterResolver;
  let moduleData: ModuleData;
  let taskId: string;

  before(async function () {
    await deployments.fixture();
    [deployer] = await ethers.getSigners();

    automate = await ethers.getContractAt("IAutomate", AUTOMATE_ADDRESS);
    oneBalance = await ethers.getContractAt("IGelato1Balance", GELATO_ADDRESS);
    (resolverModule = await ethers.getContractAt(
      "ResolverModule",
      "0x0165878A594ca255338adfa4d48449f69242Eb8F"
    )),
      console.log(
        "\x1b[32m%s\x1b[0m",
        "    ->",
        `\x1b[30mImpersonating Executor ${GELATO_ADDRESS}`
      );
    await impersonateAccount(GELATO_ADDRESS);
    counter = await ethers.getContractAt("Counter", deployer);
    counterResolver = await ethers.getContractAt("CounterResolver", deployer);

    const resolverData =
      counterResolver.interface.encodeFunctionData("checker");
    const execSelector =
      counter.interface.getFunction("increaseCount").selector;
  });
});
