# App dev reference guide

This folder contains a series of example code to serve as a reference guide for app developers looking to build on eCash.

These examples utilize the [Chronik](https://www.npmjs.com/package/chronik-client) indexer and [NodeJS](https://github.com/nvm-sh/nvm) to interact with the eCash blockchain and highlights some of the technical nuances specific to app development on eCash.

## Requirements

Please ensure your node version is > 16.x.x and the chronik and mocha dependencies are installed:

-   `nvm install 16`
-   `npm i`

## Chronik indexer

If you'd like to optionally setup your own Chronik instance, please refer to the [Chronik NNG README](https://github.com/raipay/chronik/).

## Examples

[x] [Retrieving transaction details - getDetailsFromTxid()](scripts/getDetailsFromTxid.js)

Usage: `npm run getDetailsFromTxid <txid>`

Example: `npm run getDetailsFromTxid bd6ed16b16c00808ee242e570a2672f596434c09da5290ff77cadf52387bd2f3`

[x] [Retrieving transaction history - getTxHistoryFromAddress()](scripts/getTxHistoryFromAddress.js)

Usage: `npm run getTxHistoryFromAddress <address> <page> <pageSize>`

Example: `npm run getTxHistoryFromAddress ecash:qq9h6d0a5q65fgywv4ry64x04ep906mdku8f0gxfgx 0 10`

[x] [Retrieving UTXOs - getUtxosFromAddress()](scripts/getUtxosFromAddress.js)

Usage: `npm run getUtxosFromAddress <address>`

Example: `npm run getUtxosFromAddress ecash:qq9h6d0a5q65fgywv4ry64x04ep906mdku8f0gxfgx`

[x] [Creating a new wallet - createWallet()](scripts/createWallet.js)

Usage: `npm run createWallet`

[] Collating inputs and outputs for sending XEC
[] Collating inputs and outputs for sending eTokens
[] Building and broadcasting transactions

[x] [Querying eToken details - getTokenDetails()](scripts/getTokenDetails.js)

Usage: `npm run getTokenDetails <token id>`

Example: `npm run getTokenDetails 861dede36f7f73f0af4e979fc3a3f77f37d53fe27be4444601150c21619635f4`

[] Querying holders of a particular eToken
[] Querying blockchain info
[] Using websockets to listen for confirmation of a transaction
[] Implementing CashtabPay from cashtab-components for an online store

## Questions?

If you have any questions regarding these examples please feel free to reach out to the development team via the [eCash Development Telegram](https://t.me/eCashDevelopment).
