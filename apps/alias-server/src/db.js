// Copyright (c) 2023 The Bitcoin developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

'use strict';
const config = require('../config');
const aliasConstants = require('../constants/alias');
const { isValidAliasString } = require('./utils');
const cashaddr = require('ecashaddrjs');

const MONGO_DB_ERRORCODES = {
    duplicateKey: 11000,
};

module.exports = {
    initializeDb: async function (mongoClient) {
        // Use connect method to connect to the server
        await mongoClient.connect();
        console.log('Connected successfully to MongoDB server');
        const db = mongoClient.db(config.database.name);
        // Enforce unique aliases
        db.collection(config.database.collections.validAliases).createIndex(
            {
                alias: 1,
            },
            {
                unique: true,
            },
        );
        // Check if serverState collection exists
        const serverStateExists =
            (await db
                .collection(config.database.collections.serverState)
                .countDocuments()) > 0;

        // If serverState collection does not exist
        if (!serverStateExists) {
            // Create it
            await db.createCollection(
                config.database.collections.serverState,
                // serverState may only have one document
                // 4096 is max size in bytes, required by mongo
                // 4096 is smallest max size allowed
                { capped: true, size: 4096, max: 1 },
            );
            // Initialize server with zero alias txs processed
            await module.exports.updateServerState(
                db,
                config.initialServerState,
            );
            console.log(`Initialized serverState on app startup`);
        }
        console.log(
            `Configured connection to database ${config.database.name}`,
        );
        return db;
    },
    getServerState: async function (db) {
        let serverState;
        try {
            serverState = await db
                .collection(config.database.collections.serverState)
                .find()
                // We don't need the _id field
                .project({ _id: 0 })
                .next();
            // Only 1 document in collection
            return serverState;
        } catch (err) {
            console.log(`Error in determining serverState.`, err);
            return false;
        }
    },
    updateServerState: async function (db, newServerState) {
        try {
            const { processedConfirmedTxs, processedBlockheight } =
                newServerState;

            if (
                typeof processedConfirmedTxs !== 'number' ||
                typeof processedBlockheight !== 'number'
            ) {
                return false;
            }

            // An empty document as a query i.e. {} will update the first
            // document returned in the collection
            // serverState only has one document
            const serverStateQuery = {};

            const serverStateUpdate = {
                $set: {
                    processedConfirmedTxs,
                    processedBlockheight,
                },
            };
            // If you are running the server for the first time and there is no
            // serverState in the db, create it
            const serverStateOptions = { upsert: true };

            await db
                .collection(config.database.collections.serverState)
                .updateOne(
                    serverStateQuery,
                    serverStateUpdate,
                    serverStateOptions,
                );
            return true;
        } catch (err) {
            // If this isn't updated, the server will process too many txs next time
            // TODO Let the admin know. This won't impact parsing but will cause processing too many txs
            console.log(`Error in function updateServerState.`, err);
            return false;
        }
    },
    addOneAliasToDb: async function (db, newAliasTx) {
        try {
            await db
                .collection(config.database.collections.validAliases)
                .insertOne(newAliasTx);
            return true;
        } catch (err) {
            // Only log some error other than duplicate key error
            if (err && err.code !== MONGO_DB_ERRORCODES.duplicateKey) {
                console.log(`Error in function addOneAliasToDb:`);
                console.log(err);
            }
            return false;
        }
    },
    addAliasesToDb: async function (db, newValidAliases) {
        let validAliasesAddedToDbSuccess;
        try {
            validAliasesAddedToDbSuccess = await db
                .collection(config.database.collections.validAliases)
                .insertMany(newValidAliases);
            console.log(
                `Inserted ${validAliasesAddedToDbSuccess.insertedCount} aliases into ${config.database.collections.validAliases}`,
            );
            return true;
        } catch (err) {
            console.log(`Error in function addAliasesToDb.`, err);
            return false;
        }
    },
    getAliasesFromDb: async function (db) {
        let validAliasesInDb;
        try {
            validAliasesInDb = await db
                .collection(config.database.collections.validAliases)
                .find()
                .sort({ blockheight: 1 })
                .project({ _id: 0 })
                .toArray();
            return validAliasesInDb;
        } catch (err) {
            console.log(
                `Error in determining validAliasesInDb in function getValidAliasesFromDb.`,
                err,
            );
            return false;
        }
    },
    /**
     * Lookup a registered alias object in the validAliasTxs database by querying the alias
     * Useful for checking to see if an alias is available
     * @param {object} db initialized mongodb instance
     * @param {string} alias
     * @returns {object} { _id, address, alias, blockheight, txid}
     */
    getAliasInfoFromAlias: async function (db, alias) {
        // Validation of input before calling db
        if (typeof alias !== 'string') {
            throw new Error('alias param must be a string');
        }
        if (
            alias.length < aliasConstants.minLength ||
            alias.length > aliasConstants.maxLength
        ) {
            throw new Error(
                `alias param must be between ${aliasConstants.minLength} and ${aliasConstants.maxLength} characters in length`,
            );
        }
        if (!isValidAliasString(alias)) {
            throw new Error(
                `alias param cannot contain non-alphanumeric characters`,
            );
        }
        try {
            // https://www.mongodb.com/docs/drivers/node/current/usage-examples/findOne/
            // Do not return database _id as the endpoint user does not require this info
            return await db
                .collection(config.database.collections.validAliases)
                .findOne({ alias }, { projection: { _id: 0 } });
        } catch (error) {
            throw new Error(
                `Error finding alias "${alias}" in database`,
                error,
            );
        }
    },
    /**
     * Lookup a list of registered alias objects in the validAliasTxs database by querying an address
     * Useful for checking the aliases registered to an address
     * @param {object} db initialized mongodb instance
     * @param {string} address a valid ecash address
     * @returns {array} [{ address, alias, blockheight, txid}...] or [] if no registered aliases at address
     * @throws {error} if address input is invalid
     * @throws {error} if there is an error performing the database lookup
     */
    getAliasInfoFromAddress: async function (db, address) {
        // Validate input is an ecash: address
        const isValidAddress = cashaddr.isValidCashAddress(address, 'ecash');
        if (!isValidAddress) {
            throw new Error('Input must be a valid eCash address');
        }

        // Note: prefixless address is valid if checksum matches 'ecash'
        // But database stores all addresses with a prefix
        if (!address.startsWith('ecash:')) {
            //  If query comes from a prefixless valid address, give it a prefix for your db query
            address = `ecash:${address}`;
        }

        let aliasesRegisteredAtThisAddress;
        try {
            aliasesRegisteredAtThisAddress = await db
                .collection(config.database.collections.validAliases)
                .find({ address })
                .sort({ blockheight: 1 })
                .project({ _id: 0 })
                .toArray();
            return aliasesRegisteredAtThisAddress;
        } catch (err) {
            throw new Error(
                `Error finding aliases for address ${address} in database`,
                err,
            );
        }
    },
};
