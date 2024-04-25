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
  CounterTestWT,
  IGelato,
  ProxyModule,
  SingleExecModule,
} from "../../../typechain-types";

const { ethers, deployments } = hre;

import { getGelatoAddress } from "../../../hardhat/config/addresses";

const GELATO = "0x3caca7b48d0573d793d3b0279b5f0029180e83b6";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const FEE = ethers.parseEther("0.1");

describe("Automate Without 1Balance test", function () {
  let automate: Automate;
  let counterWT: CounterTestWT;
  let singleExecModule: SingleExecModule;
  let proxyModule: ProxyModule;
  let feeCollector: string;

  let user: Signer;
  let userAddress: string;

  let executor: Signer;

  let taskId: string;
  let execData: string;
  let execSelector: string;
  let moduleData: ModuleData;

  beforeEach(async function () {
    await deployments.fixture();

    const gelato = await ethers.getContractAt("IGelato", GELATO);
    feeCollector = await gelato.feeCollector();

    [, user] = await hre.ethers.getSigners();
    userAddress = await user.getAddress();

    automate = await ethers.getContractAt(
      "Automate",
      (
        await deployments.get("Automate")
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

    // Automate Proxy module need to be set-up before being able to deploy CounterTestWT
    const counterWtFactory = await ethers.getContractFactory("CounterTestWT");
    counterWT = <CounterTestWT>(
      await counterWtFactory.deploy(await automate.getAddress(), userAddress)
    );

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GELATO],
    });
    executor = await ethers.provider.getSigner(GELATO);

    // create task
    execData = counterWT.interface.encodeFunctionData("increaseCount", [10]);
    moduleData = {
      modules: [Module.PROXY, Module.SINGLE_EXEC],
      args: ["0x", "0x"],
    };
    execSelector = counterWT.interface.getFunction("increaseCount").selector;
    taskId = getTaskId(
      userAddress,
      await counterWT.getAddress(),
      execSelector,
      moduleData,
      ETH
    );

    await automate
      .connect(user)
      .createTask(counterWT.getAddress(), execData, moduleData, ETH);

    // Topup Counter contract funds
    await user.sendTransaction({
      to: await counterWT.getAddress(),
      value: ethers.parseEther("1"),
    });
  });

  it("create task", async () => {
    const taskIds = await automate.getTaskIdsByUser(userAddress);
    expect(taskIds).include(taskId);
  });

  it("create task - duplicate", async () => {
    await expect(
      automate
        .connect(user)
        .createTask(await counterWT.getAddress(), execData, moduleData, ETH)
    ).to.be.revertedWith("Automate.createTask: Duplicate task");
  });

  it("exec", async () => {
    const countBefore = await counterWT.count();

    await execute(true);

    const countAfter = await counterWT.count();
    expect(countAfter).to.be.gt(countBefore);

    const taskIds = await automate.getTaskIdsByUser(userAddress);
    expect(taskIds).not.include(taskId);
  });

  it("send funds to feeCollector", async () => {
    const balanceBefore = await ethers.provider.getBalance(feeCollector);

    await execute(true);

    const balanceAfter = await ethers.provider.getBalance(feeCollector);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  const execute = async (revertOnFailure: boolean) => {
    await automate
      .connect(executor)
      .exec(
        userAddress,
        await counterWT.getAddress(),
        execData,
        moduleData,
        FEE,
        ETH,
        revertOnFailure
      );
  };
});
