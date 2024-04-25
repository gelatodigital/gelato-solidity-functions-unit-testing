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
  ProxyModule,
  SingleExecModule,
} from "../../../typechain-types";

const { ethers, deployments } = hre;

import { getGelatoAddress } from "../../../hardhat/config/addresses";

const GELATO_ADDRESS = getGelatoAddress("hardhat");
const AUTOMATE_ADDRESS = "0xa85EffB2658CFd81e0B1AaD4f2364CdBCd89F3a1";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO_ADD = ethers.ZeroAddress;

describe("Automate SingleExec module test", function () {
  let automate: Automate;
  let counter: CounterTest;
  let singleExecModule: SingleExecModule;
  let proxyModule: ProxyModule;

  let user: Signer;
  let userAddress: string;

  let executor: Signer;

  let taskId: string;
  let execData: string;
  let execSelector: string;
  let moduleData: ModuleData;

  beforeEach(async function () {
    await deployments.fixture();

    [, user] = await hre.ethers.getSigners();
    userAddress = await user.getAddress();

    automate = await ethers.getContractAt(
      "Automate",
      (
        await deployments.get("Automate")
      ).address
    );
    counter = await ethers.getContractAt(
      "CounterTest",
      (
        await deployments.get("CounterTest")
      ).address
    );
    singleExecModule = await ethers.getContractAt(
      "SingleExecModule",
      (
        await deployments.get("SingleExecModule")
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
      [Module.SINGLE_EXEC, Module.PROXY],
      [await singleExecModule.getAddress(), await proxyModule.getAddress()]
    );

    await impersonateAccount(GELATO_ADDRESS);
    executor = await ethers.provider.getSigner(GELATO_ADDRESS);

    // create task
    execData = counter.interface.encodeFunctionData("increaseCount", [10]);
    moduleData = {
      modules: [Module.PROXY, Module.SINGLE_EXEC],
      args: ["0x", "0x"],
    };
    execSelector = counter.interface.getFunction("increaseCount").selector;
    taskId = getTaskId(
      userAddress,
      await counter.getAddress(),
      execSelector,
      moduleData,
      ZERO_ADD
    );

    await automate
      .connect(user)
      .createTask(await counter.getAddress(), execData, moduleData, ZERO_ADD);
  });

  it("create task", async () => {
    const taskIds = await automate.getTaskIdsByUser(userAddress);
    expect(taskIds).include(taskId);
  });

  it("create task - duplicate", async () => {
    await expect(
      automate
        .connect(user)
        .createTask(await counter.getAddress(), execData, moduleData, ZERO_ADD)
    ).to.be.revertedWith("Automate.createTask: Duplicate task");
  });

  it("create task - duplicate with different args", async () => {
    moduleData = { ...moduleData, args: ["0x01"] };
    await automate
      .connect(user)
      .createTask(await counter.getAddress(), execData, moduleData, ZERO_ADD);

    taskId = getTaskId(
      userAddress,
      await counter.getAddress(),
      execSelector,
      moduleData,
      ZERO_ADD
    );

    const taskIds = await automate.getTaskIdsByUser(userAddress);
    expect(taskIds).include(taskId);
  });

  it("exec", async () => {
    const countBefore = await counter.count();

    await execute(true);

    const countAfter = await counter.count();
    expect(countAfter).to.be.gt(countBefore);

    const taskIds = await automate.getTaskIdsByUser(userAddress);
    expect(taskIds).not.include(taskId);
  });

  const execute = async (revertOnFailure: boolean) => {
    const gelato1BalanceParam = getGelato1BalanceParam({});

    await automate
      .connect(executor)
      .exec1Balance(
        userAddress,
        await counter.getAddress(),
        execData,
        moduleData,
        gelato1BalanceParam,
        revertOnFailure
      );
  };
});
