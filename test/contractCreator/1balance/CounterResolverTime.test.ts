import { AutomateModule, TriggerType } from "@gelatonetwork/automate-sdk";
import { expect } from "chai";
import {
  Automate,
  AutomateTaskCreatorTest,
  AutomateTaskCreatorUpgradeableTest,
  IGelato,
  OpsProxyFactory,
  ProxyModule,
} from "../../../typechain-types";
import { Module } from "../../utils";
import hre = require("hardhat");
const { ethers, deployments } = hre;

describe("AutomateTaskCreator test", function () {
  let automate: Automate;
  let proxyModule: ProxyModule;
  let automateTaskCreator: AutomateTaskCreatorTest;
  let automateTaskCreatorUpgradeable: AutomateTaskCreatorUpgradeableTest;
  let automateModule: AutomateModule;

  before(async function () {
    await deployments.fixture();
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    automateModule = new AutomateModule();

    automate = await ethers.getContractAt(
      "Automate",
      (
        await deployments.get("Automate")
      ).address
    );
    proxyModule = await ethers.getContractAt(
      "ProxyModule",
      (
        await deployments.get("ProxyModule")
      ).address
    );

    await automate.setModule([Module.PROXY], [proxyModule.getAddress()]);

    const automateTaskCreatorFactory = await ethers.getContractFactory(
      "AutomateTaskCreatorTest"
    );

    const res = await deployments.deploy("AutomateTaskCreatorUpgradeableTest", {
      from: deployerAddress,
      args: [await automate.getAddress()],
      proxy: { execute: { init: { methodName: "initialize", args: [] } } },
    });

    automateTaskCreator = (await automateTaskCreatorFactory.deploy(
      automate.getAddress()
    )) as AutomateTaskCreatorTest;

    automateTaskCreatorUpgradeable = (await ethers.getContractAt(
      "AutomateTaskCreatorUpgradeableTest",
      res.address
    )) as AutomateTaskCreatorUpgradeableTest;
  });

  it("should initialize upgradeable contract", async () => {
    const dedicatedMsgSender =
      await automateTaskCreatorUpgradeable.dedicatedMsgSender();
    const feeCollector = await automateTaskCreatorUpgradeable.getFeeCollector();

    const proxyFactoryAddress = await proxyModule.opsProxyFactory();
    const proxyFactory = (await ethers.getContractAt(
      "OpsProxyFactory",
      proxyFactoryAddress
    )) as OpsProxyFactory;

    const [expectedDedicatedMsgSender] = await proxyFactory.getProxyOf(
      automateTaskCreatorUpgradeable.getAddress()
    );

    const gelatoAddress = await automate.gelato();
    const gelato = (await ethers.getContractAt(
      "IGelato",
      gelatoAddress
    )) as IGelato;
    const expectedFeeCollector = await gelato.feeCollector();

    expect(dedicatedMsgSender).to.be.eql(expectedDedicatedMsgSender);
    expect(feeCollector).to.be.eql(expectedFeeCollector);
  });

  it("should return resolver module data", async () => {
    const [resolverAddress, resolverData] =
      await automateTaskCreator.resolverModuleArgs();

    const resolverModuleData = await automateTaskCreator.resolverModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      resolverAddress,
      resolverData,
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(resolverModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(resolverModuleData[1])
    );
  });

  it("should return singleExec module data", async () => {
    const singleExecModuleData =
      await automateTaskCreator.singleExecModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      singleExec: true,
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(singleExecModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(singleExecModuleData[1])
    );
  });

  it("should return proxy module data", async () => {
    const proxyModuleData = await automateTaskCreator.proxyModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      dedicatedMsgSender: true,
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(proxyModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(Number(proxyModuleData[1]));
  });

  it("should return web3 function module data", async () => {
    const [web3FunctionHash, currency, oracleAddress] =
      await automateTaskCreator.web3FunctionArg();

    const web3FunctionModuleData =
      await automateTaskCreator.web3FunctionModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      web3FunctionHash,
      web3FunctionArgs: {
        currency: currency,
        oracle: oracleAddress,
      },
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(web3FunctionModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(web3FunctionModuleData[1])
    );
  });

  it("should return time trigger module data", async () => {
    const [startTime, interval] = await automateTaskCreator.timeTriggerArg();

    const timeTriggerModuleData =
      await automateTaskCreator.timeTriggerModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      trigger: {
        type: TriggerType.TIME,
        start: Number(startTime),
        interval: Number(interval),
      },
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(timeTriggerModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(timeTriggerModuleData[1])
    );
  });

  it("should return cron trigger module data", async () => {
    const cronExpression = await automateTaskCreator.cronTriggerArg();

    const cronTriggerModuleData =
      await automateTaskCreator.cronTriggerModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      trigger: {
        type: TriggerType.CRON,
        cron: cronExpression,
      },
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(cronTriggerModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(cronTriggerModuleData[1])
    );
  });

  it("should return event trigger module data", async () => {
    const [address, topics, blockConfirmations] =
      await automateTaskCreator.eventTriggerArg();

    const eventTriggerModuleData =
      await automateTaskCreator.eventTriggerModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      trigger: {
        type: TriggerType.EVENT,
        filter: {
          address,
          topics,
        },
        blockConfirmations: Number(blockConfirmations),
      },
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(eventTriggerModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(eventTriggerModuleData[1])
    );
  });

  it("should return block trigger module data", async () => {
    const blockTriggerModuleData =
      await automateTaskCreator.blockTriggerModuleData();

    const expectedModuleData = await automateModule.encodeModuleArgs({
      trigger: {
        type: TriggerType.BLOCK,
      },
    });

    expect(Number(expectedModuleData.modules)).to.eql(
      Number(blockTriggerModuleData[0])
    );
    expect(Number(expectedModuleData.args)).to.eql(
      Number(blockTriggerModuleData[1])
    );
  });
});
