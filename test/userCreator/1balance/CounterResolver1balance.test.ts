import { Signer, ZeroAddress } from "ethers";
import { expect } from "chai";
import hre = require("hardhat");
import {
  impersonateAccount,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  Module,
  ModuleData,
  encodeResolverArgs,
  getTaskId,
  getGelato1BalanceParam,
  fastForwardTime,
} from "../../utils";
import {
  Automate,
  CounterTest,
  ResolverModule,
  ProxyModule,
} from "../../../typechain-types";

const { ethers, deployments } = hre;

import { getGelatoAddress } from "../../../hardhat/config/addresses";

const GELATO_ADDRESS = getGelatoAddress("hardhat");
const AUTOMATE_ADDRESS = "0xa85EffB2658CFd81e0B1AaD4f2364CdBCd89F3a1";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO_ADD = ethers.ZeroAddress;
const FEE = ethers.parseEther("0.1");
const INTERVAL = 180;

describe("UserCreator Gelato Automate Resolver Contract", function () {
  this.timeout(0);

  let deployer: Signer;
  let deployerAddress: string;
  let executor: Signer;
  let automate: Automate;
  let resolverModule: ResolverModule;
  let counter: CounterTest;
  let moduleData: ModuleData;
  let proxyModule: ProxyModule;
  let taskId: string;
  let execSelector: string;

  before(async function () {
    await deployments.fixture();
    [deployer] = await hre.ethers.getSigners();
    deployerAddress = await deployer.getAddress();

    automate = await ethers.getContractAt("Automate", AUTOMATE_ADDRESS);
    counter = await ethers.getContractAt(
      "CounterTest",
      (
        await deployments.get("CounterTest")
      ).address
    );
    resolverModule = await ethers.getContractAt(
      "ResolverModule",
      (
        await deployments.get("ResolverModule")
      ).address
    );
    proxyModule = await ethers.getContractAt(
      "ProxyModule",
      (
        await deployments.get("ProxyModule")
      ).address
    );

    // set-up
    await automate.setModule(
      [Module.RESOLVER, Module.PROXY],
      [await resolverModule.getAddress(), await proxyModule.getAddress()]
    );
    await impersonateAccount(GELATO_ADDRESS);
    executor = await ethers.provider.getSigner(GELATO_ADDRESS);
    // Create-task
    const resolverData = counter.interface.encodeFunctionData("checker");
    const resolverArgs = encodeResolverArgs(
      await counter.getAddress(),
      resolverData
    );
    execSelector = counter.interface.getFunction("increaseCount").selector;
    moduleData = {
      modules: [Module.RESOLVER, Module.PROXY],
      args: [resolverArgs, "0x"],
    };
    taskId = taskId = getTaskId(
      deployerAddress,
      await counter.getAddress(),
      execSelector,
      moduleData,
      ZERO_ADD
    );
    await automate
      .connect(deployer)
      .createTask(
        await counter.getAddress(),
        execSelector,
        moduleData,
        ZeroAddress
      );
  });

  it("create task", async () => {
    const taskIds = await automate.getTaskIdsByUser(deployerAddress);
    expect(taskIds).include(taskId);
  });

  it("create task - duplicate", async () => {
    await expect(
      automate
        .connect(deployer)
        .createTask(
          await counter.getAddress(),
          execSelector,
          moduleData,
          ZERO_ADD
        )
    ).to.be.revertedWith("Automate.createTask: Duplicate task");
  });

  it("exec", async () => {
    const countBefore = await counter.count();

    await execute(true);

    const countAfter = await counter.count();
    expect(countAfter).to.be.gt(countBefore);
  });

  it("exec - call reverts", async () => {
    fastForwardTime(180);
    const count = await counter.count();

    await execute(true);

    const count2 = await counter.count();
    expect(count2).to.be.gt(count);

    // will fail in off-chain simulation
    execSelector = counter.interface.getFunction(
      "increaseCountReverts"
    ).selector;
    const resolverData = counter.interface.encodeFunctionData("checkerReverts");
    const resolverArgs = encodeResolverArgs(
      await counter.getAddress(),
      resolverData
    );
    moduleData = {
      modules: [Module.RESOLVER, Module.PROXY],
      args: [resolverArgs, "0x"],
    };

    await automate
      .connect(deployer)
      .createTask(
        await counter.getAddress(),
        execSelector,
        moduleData,
        ZERO_ADD
      );

    await expect(execute(true, true)).to.be.revertedWith(
      "Automate.exec: OpsProxy.executeCall: Counter: reverts"
    );

    // will not fail on-chain
    await execute(false, true);

    const count3 = await counter.count();
    expect(count3).to.be.eql(count2);
  });

  const execute = async (revertOnFailure: boolean, callReverts = false) => {
    const [, execData] = callReverts
      ? await counter.checkerReverts()
      : await counter.checker();

    const gelato1BalanceParam = getGelato1BalanceParam({});

    await automate
      .connect(executor)
      .exec1Balance(
        deployerAddress,
        await counter.getAddress(),
        execData,
        moduleData,
        gelato1BalanceParam,
        revertOnFailure
      );
  };
});
