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
  ResolverModule,
  ProxyModule,
  CounterResolver,
  OpsProxyFactory,
  OpsProxy,
  SingleExecModule,
  Web3FunctionModule,
  TriggerModule,
  CounterWL,
} from "../../../typechain-types";

const { ethers, deployments } = hre;

import { getGelatoAddress } from "../../../hardhat/config/addresses";
const GELATO_ADDRESS = getGelatoAddress("hardhat");
const ZERO_ADD = ethers.ZeroAddress;

describe("Automate multi module test", function () {
  let automate: Automate;
  let counter: CounterWL;
  let counterResolver: CounterResolver;
  let opsProxyFactory: OpsProxyFactory;
  let opsProxy: OpsProxy;

  let resolverModule: ResolverModule;
  let proxyModule: ProxyModule;
  let singleExecModule: SingleExecModule;
  let web3FunctionModule: Web3FunctionModule;
  let triggerModule: TriggerModule;

  let user: Signer;
  let userAddress: string;

  let executor: Signer;

  let taskId: string;
  let execSelector: string;
  let moduleData: ModuleData;
  let resolverArgs: string;

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
      "CounterWL",
      (
        await deployments.get("CounterWL")
      ).address
    );
    counterResolver = await ethers.getContractAt(
      "CounterResolver",
      (
        await deployments.get("CounterResolver")
      ).address
    );
    opsProxyFactory = await ethers.getContractAt(
      "OpsProxyFactory",
      (
        await deployments.get("OpsProxyFactory")
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
    singleExecModule = await ethers.getContractAt(
      "SingleExecModule",
      (
        await deployments.get("SingleExecModule")
      ).address
    );
    web3FunctionModule = await ethers.getContractAt(
      "Web3FunctionModule",
      (
        await deployments.get("Web3FunctionModule")
      ).address
    );
    triggerModule = await ethers.getContractAt(
      "TriggerModule",
      (
        await deployments.get("TriggerModule")
      ).address
    );

    // set-up
    await automate.setModule(
      [
        Module.RESOLVER,
        Module.PROXY,
        Module.SINGLE_EXEC,
        Module.WEB3_FUNCTION,
        Module.TRIGGER,
      ],
      [
        await resolverModule.getAddress(),
        await proxyModule.getAddress(),
        await singleExecModule.getAddress(),
        await web3FunctionModule.getAddress(),
        await triggerModule.getAddress(),
      ]
    );

    await impersonateAccount(GELATO_ADDRESS);
    executor = await ethers.provider.getSigner(GELATO_ADDRESS);

    // deploy proxy
    await opsProxyFactory.connect(user).deploy();

    // create task
    const resolverData =
      counterResolver.interface.encodeFunctionData("checker");
    resolverArgs = encodeResolverArgs(
      await counterResolver.getAddress(),
      resolverData
    );

    execSelector = counter.interface.getFunction("increaseCount").selector;
    moduleData = {
      modules: [Module.RESOLVER, Module.PROXY, Module.SINGLE_EXEC],
      args: [resolverArgs, "0x", "0x"],
    };

    taskId = getTaskId(
      userAddress,
      await counter.getAddress(),
      execSelector,
      moduleData,
      ZERO_ADD
    );

    await automate
      .connect(user)
      .createTask(
        await counter.getAddress(),
        execSelector,
        moduleData,
        ZERO_ADD
      );

    const [proxyAddress] = await opsProxyFactory.getProxyOf(userAddress);
    opsProxy = await ethers.getContractAt("OpsProxy", proxyAddress);

    // whitelist proxy on counter
    await counter.setWhitelist(await opsProxy.getAddress(), true);
    expect(await counter.whitelisted(await opsProxy.getAddress())).to.be.true;
  });

  it("getTaskId", async () => {
    fastForwardTime(180);
    const thisTaskId = await automate.getTaskId(
      userAddress,
      await counter.getAddress(),
      execSelector,
      moduleData,
      ZERO_ADD
    );

    const expectedTaskId = taskId;

    expect(thisTaskId).to.be.eql(expectedTaskId);
  });

  it("createTask - task created", async () => {
    const taskIds = await automate.getTaskIdsByUser(userAddress);
    expect(taskIds).include(taskId);
  });

  it("createTask - wrong module order", async () => {
    moduleData = {
      modules: [Module.RESOLVER, Module.SINGLE_EXEC, Module.PROXY],
      args: [resolverArgs, "0x", "0x"],
    };

    await expect(
      automate
        .connect(user)
        .createTask(
          await counter.getAddress(),
          execSelector,
          moduleData,
          ZERO_ADD
        )
    ).to.be.revertedWith("Automate._validModules: Asc only");
  });

  it("createTask - duplicate modules", async () => {
    moduleData = {
      modules: [Module.RESOLVER, Module.RESOLVER, Module.PROXY],
      args: [resolverArgs, resolverArgs, "0x"],
    };

    await expect(
      automate
        .connect(user)
        .createTask(
          await counter.getAddress(),
          execSelector,
          moduleData,
          ZERO_ADD
        )
    ).to.be.revertedWith("Automate._validModules: Asc only");
  });

  it("createTask - only one resolver", async () => {
    moduleData = {
      modules: [Module.RESOLVER, Module.PROXY, Module.WEB3_FUNCTION],
      args: ["0x", "0x", "0x"],
    };

    await expect(
      automate.createTask(
        await counter.getAddress(),
        execSelector,
        moduleData,
        ZERO_ADD
      )
    ).to.be.revertedWith(
      "Automate._validModules: Only RESOLVER or WEB3_FUNCTION"
    );
  });

  it("createTask - no modules", async () => {
    moduleData = {
      modules: [],
      args: [],
    };

    await expect(
      automate.createTask(
        await counter.getAddress(),
        execSelector,
        moduleData,
        ZERO_ADD
      )
    ).to.be.revertedWith("Automate._validModules: PROXY is required");
  });

  it("createTask - only proxy", async () => {
    await counter.setWhitelist(await automate.getAddress(), true);
    expect(await counter.whitelisted(await automate.getAddress())).to.be.true;
    moduleData = { modules: [Module.PROXY], args: ["0x"] };
    const execData = counter.interface.encodeFunctionData("increaseCount", [
      10,
    ]);

    await automate
      .connect(user)
      .createTask(await counter.getAddress(), execData, moduleData, ZERO_ADD);

    const countBefore = await counter.count();

    await execute(true);

    const countAfter = await counter.count();
    expect(countAfter).to.be.gt(countBefore);
  });

  it("exec1Balance", async () => {
    const countBefore = await counter.count();
    const [, execData] = await counterResolver.checker();

    const target = await counter.getAddress();

    const gelato1BalanceParam = getGelato1BalanceParam({});

    await expect(
      automate
        .connect(executor)
        .exec1Balance(
          userAddress,
          await counter.getAddress(),
          execData,
          moduleData,
          gelato1BalanceParam,
          true
        )
    )
      .to.emit(automate, "LogUseGelato1Balance")
      .withArgs(
        gelato1BalanceParam.sponsor,
        target,
        gelato1BalanceParam.feeToken,
        gelato1BalanceParam.oneBalanceChainId,
        gelato1BalanceParam.nativeToFeeTokenXRateNumerator,
        gelato1BalanceParam.nativeToFeeTokenXRateDenominator,
        gelato1BalanceParam.correlationId
      );

    const countAfter = await counter.count();

    expect(countAfter).to.be.gt(countBefore);
  });

  const execute = async (revertOnFailure: boolean) => {
    const [, execData] = await counterResolver.checker();

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
