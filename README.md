# Overview

This repository contains tools and scripts to simulate Gelato Automate locally for testing Solidity functions. It allows developers to deploy contracts and execute transactions on a local environment, which mirrors the behavior of Gelato Automate without the need for deploying on the mainnet or testnets. This is particularly useful for developing and testing automated tasks and smart contract interactions in a controlled environment.

# Installation

Clone the repository and install its dependencies:

    ```bash
    git clone https://github.com/gelatodigital/gelato-solidity-functions-unit-testing.git
    cd gelato-solidity-functions-unit-testing
    yarn install
    ```

## Quick Start

Setup your local blockchain

        ```bash
        yarn hardhat node
        ```

This command will start a local Hardhat node and deploy the Gelato contracts to it. The output will show the accounts and private keys that are available for testing. You can check the addresses in the Deployments folder.

## Testing

To run the tests, execute the following command:

    ```bash
    yarn hardhat test
    ```
