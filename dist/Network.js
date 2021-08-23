"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResult = exports.isPurchase = exports.ethToWei = exports.weiToEth = exports.weiToGwei = exports.gweiToWei = exports.verifySignature = exports.assertProperlySigned = exports.makeProvider = exports.createContract = exports.waitForTransaction = exports.aggregateBulkGetter = exports.neverResolves = exports.getGasSettingGwei = exports.callWithRetry = void 0;
const constants_1 = require("@darkforest_eth/constants");
const ethers_1 = require("ethers");
const p_retry_1 = __importDefault(require("p-retry"));
const p_timeout_1 = __importDefault(require("p-timeout"));
/**
 * Calls the given function, retrying it if there is an error.
 *
 * @todo Get rid of this, and make use of {@link ContractCaller}.
 */
const callWithRetry = async (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
fn, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
args = [], onError, maxRetries = constants_1.DEFAULT_MAX_CALL_RETRIES, retryInterval = 1000) => {
    return p_retry_1.default(() => fn(...args), {
        // TODO: Should we set maxRetryTime?
        retries: maxRetries,
        minTimeout: retryInterval,
        maxTimeout: 60000,
        onFailedAttempt(e) {
            console.error(`error: ${e}`);
            console.log(`retrying (${e.attemptNumber + 1}/${maxRetries})...`);
            if (onError) {
                try {
                    onError(e.attemptNumber, e);
                }
                catch (e) {
                    console.log(`failed executing callWithRetry error handler`, e);
                }
            }
        },
    });
};
exports.callWithRetry = callWithRetry;
/**
 * Given the user's auto gas setting, and the current set of gas prices on the network, returns the
 * preferred gas price. If an invalid {@link AutoGasSetting} is provided, then returns undefined.
 */
function getGasSettingGwei(setting, gasPrices) {
    switch (setting) {
        case "Slow" /* Slow */:
            return gasPrices.slow;
        case "Average" /* Average */:
            return gasPrices.average;
        case "Fast" /* Fast */:
            return gasPrices.fast;
        default:
            return undefined;
    }
}
exports.getGasSettingGwei = getGasSettingGwei;
/**
 * A function that just never resolves.s
 */
function neverResolves() {
    return new Promise(() => { });
}
exports.neverResolves = neverResolves;
/**
 * A useful utility function that breaks up the proverbial number line (defined by {@code total} and
 * {@code querySize}), and calls {@code getterFn} for each of the sections on the number line.
 *
 * @param total the total amount of of items to get
 * @param querySize the chunk size
 * @param getterFn a function that fetches something, given a start index and end index
 * @param onProgress whenever a chunk is loaded, this function is called with the fraction of
 * individual items that have been loaded so far.
 * @returns a list of each of the individual items that were loaded.
 */
const aggregateBulkGetter = async (total, querySize, getterFn, 
// the parameter to this function is a value between 0 and 1. We guarantee at least one call to
// `onProgress` if you provide it. The guaranteed call is the one at the end, where the value is 1.
onProgress) => {
    const promises = [];
    let loadedSoFar = 0;
    for (let i = 0; i < total / querySize; i += 1) {
        const start = i * querySize;
        const end = Math.min((i + 1) * querySize, total);
        const loadedThisBatch = end - start;
        promises.push(new Promise(async (resolve) => {
            let res = [];
            while (res.length === 0) {
                res = await getterFn(start, end);
                loadedSoFar += loadedThisBatch;
                onProgress && onProgress(loadedSoFar / total);
            }
            resolve(res);
        }));
    }
    const unflattenedResults = await Promise.all(promises);
    onProgress && onProgress(1);
    return unflattenedResults.flat();
};
exports.aggregateBulkGetter = aggregateBulkGetter;
/**
 * Given a transaction hash and a JsonRpcProvider, waits for the given transaction to complete.
 */
function waitForTransaction(provider, txHash) {
    return p_retry_1.default(async (tries) => {
        console.log(`[wait-tx] WAITING ON tx hash: ${txHash} tries ${tries}`);
        try {
            const receipt = await p_timeout_1.default(provider.getTransactionReceipt(txHash), 30 * 1000);
            if (receipt) {
                console.log(`[wait-tx] FINISHED tx hash: ${txHash} tries ${tries}`);
                return receipt;
            }
            else {
                return Promise.reject(new Error("couldn't get receipt"));
            }
        }
        catch (e) {
            console.error(`[wait-tx] TIMED OUT tx hash: ${txHash} tries ${tries} error:`, e);
            return Promise.reject(e);
        }
    }, {
        // TODO: Should we set maxRetryTime?
        retries: constants_1.DEFAULT_MAX_CALL_RETRIES,
        minTimeout: 2000,
        maxTimeout: 60000,
        factor: 1.5,
        onFailedAttempt(e) {
            console.log(`[wait-tx] SLEEPING tx hash: ${txHash} tries ${e.attemptNumber} sleeping...`);
        },
    });
}
exports.waitForTransaction = waitForTransaction;
/**
 * @param contractAddress the address of the contract you want to connect to
 * @param contractABI a javacript object representing the ABI
 */
function createContract(contractAddress, contractABI, provider, signer) {
    return new ethers_1.Contract(contractAddress, contractABI, signer !== null && signer !== void 0 ? signer : provider);
}
exports.createContract = createContract;
/**
 * Creates a new {@link JsonRpcProvider}, and makes sure that it's connected to xDai if we're in
 * production.
 */
function makeProvider(rpcUrl) {
    let provider;
    if (rpcUrl.startsWith('wss://')) {
        provider = new ethers_1.providers.WebSocketProvider(rpcUrl);
    }
    else {
        provider = new ethers_1.providers.StaticJsonRpcProvider(rpcUrl);
        provider.pollingInterval = 8000;
    }
    return provider;
}
exports.makeProvider = makeProvider;
/**
 * Ensures that the given message was properly signed.
 */
function assertProperlySigned(message) {
    const preSigned = JSON.stringify(message.message);
    if (!verifySignature(preSigned, message.signature, message.sender)) {
        throw new Error(`failed to verify: ${message}`);
    }
}
exports.assertProperlySigned = assertProperlySigned;
/**
 * Returns whether or not the given message was signed by the given address.
 */
function verifySignature(message, signature, address) {
    return ethers_1.utils.verifyMessage(message, signature).toLowerCase() === address;
}
exports.verifySignature = verifySignature;
/**
 * Returns the given amount of gwei in wei as a big integer.
 */
function gweiToWei(gwei) {
    return ethers_1.utils.parseUnits(gwei + '', 'gwei');
}
exports.gweiToWei = gweiToWei;
/**
 * Returns the given amount of wei in gwei as a number.
 */
function weiToGwei(wei) {
    return parseFloat(ethers_1.utils.formatUnits(wei, 'gwei'));
}
exports.weiToGwei = weiToGwei;
/**
 * Returns the given amount of wei in gwei as a number.
 */
function weiToEth(wei) {
    return parseFloat(ethers_1.utils.formatEther(wei));
}
exports.weiToEth = weiToEth;
/**
 * Returns the given amount of eth in wei as a big integer.
 */
function ethToWei(eth) {
    return ethers_1.utils.parseEther(eth + '');
}
exports.ethToWei = ethToWei;
/**
 * Whether or not some value is being transferred in this transaction.
 */
function isPurchase(tx) {
    return tx.value !== undefined && tx.value > 0;
}
exports.isPurchase = isPurchase;
/**
 * When you submit a transaction via {@link TxExecutor}, you are given a {@link PendingTransaction}.
 * This function either resolves when the transaction confirms, or rejects if there is any error.
 */
async function getResult(pendingTransaction) {
    const [_submitted, confirmed] = await Promise.all([
        pendingTransaction.submitted,
        pendingTransaction.confirmed,
    ]);
    return confirmed;
}
exports.getResult = getResult;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTmV0d29yay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9OZXR3b3JrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHlEQUFxRTtBQUdyRSxtQ0FBMEY7QUFDMUYsc0RBQTRCO0FBQzVCLDBEQUFnQztBQUtoQzs7OztHQUlHO0FBQ0ksTUFBTSxhQUFhLEdBQUcsS0FBSztBQUNoQyw4REFBOEQ7QUFDOUQsRUFBa0M7QUFDbEMsOERBQThEO0FBQzlELE9BQWMsRUFBRSxFQUNoQixPQUEyQixFQUMzQixVQUFVLEdBQUcsb0NBQXdCLEVBQ3JDLGFBQWEsR0FBRyxJQUFJLEVBQ1IsRUFBRTtJQUNkLE9BQU8saUJBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRTtRQUM5QixvQ0FBb0M7UUFDcEMsT0FBTyxFQUFFLFVBQVU7UUFDbkIsVUFBVSxFQUFFLGFBQWE7UUFDekIsVUFBVSxFQUFFLEtBQU07UUFDbEIsZUFBZSxDQUFDLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGFBQWEsR0FBRyxDQUFDLElBQUksVUFBVSxNQUFNLENBQUMsQ0FBQztZQUNsRSxJQUFJLE9BQU8sRUFBRTtnQkFDWCxJQUFJO29CQUNGLE9BQU8sQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO2lCQUM3QjtnQkFBQyxPQUFPLENBQUMsRUFBRTtvQkFDVixPQUFPLENBQUMsR0FBRyxDQUFDLDhDQUE4QyxFQUFFLENBQUMsQ0FBQyxDQUFDO2lCQUNoRTthQUNGO1FBQ0gsQ0FBQztLQUNGLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQztBQTFCVyxRQUFBLGFBQWEsaUJBMEJ4QjtBQUVGOzs7R0FHRztBQUNILFNBQWdCLGlCQUFpQixDQUMvQixPQUF1QixFQUN2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