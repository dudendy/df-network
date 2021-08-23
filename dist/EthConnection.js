"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEthConnection = exports.EthConnection = void 0;
const constants_1 = require("@darkforest_eth/constants");
const events_1 = require("@darkforest_eth/events");
const serde_1 = require("@darkforest_eth/serde");
const ethers_1 = require("ethers");
const just_debounce_1 = __importDefault(require("just-debounce"));
const Network_1 = require("./Network");
const xDaiApi_1 = require("./xDaiApi");
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Responsible for
 * 1) loading the contracts
 * 2) connecting to the network
 */
class EthConnection {
    constructor(provider, blockNumber) {
        /**
         * Represents the gas price one would pay to achieve the corresponding transaction confirmation
         * speed.
         */
        this.gasPrices = constants_1.DEFAULT_GAS_PRICES;
        this.contracts = new Map();
        this.loaders = new Map();
        this.provider = provider;
        this.balance = ethers_1.BigNumber.from('0');
        this.blockNumber = blockNumber;
        this.blockNumber$ = events_1.monomitter(true);
        this.rpcChanged$ = events_1.monomitter(true);
        this.myBalance$ = events_1.monomitter(true);
        this.gasPrices$ = events_1.monomitter();
        this.rpcChanged$.publish(provider.connection.url);
        this.startPolling();
    }
    async reloadContracts() {
        for (const [address, loader] of this.loaders) {
            // Was going to dedupe this with `this.loadContract` but there is no reason to set the loader again.
            const contract = await loader(address, this.provider, this.signer);
            this.contracts.set(address, contract);
        }
    }
    /**
     * Loads a contract into this {@link EthConnection}.
     *
     * @param address The contract address to register the contract against.
     * @param loader The loader used to load (or reload) this contract.
     */
    async loadContract(address, loader) {
        this.loaders.set(address, loader);
        const contract = await loader(address, this.provider, this.signer);
        this.contracts.set(address, contract);
        return contract;
    }
    /**
     * Retreives a contract from the registry. Must exist otherwise this will throw.
     * @param address The address to load from the registry.
     * @returns The contract requested
     */
    getContract(address) {
        const contract = this.contracts.get(address);
        if (!contract) {
            throw new Error(`Contract never loaded. Address: ${address}`);
        }
        return contract;
    }
    /**
     * Changes the RPC url we're connected to, and reloads the ethers contract references.
     */
    async setRpcUrl(rpcUrl) {
        const newProvider = await Network_1.makeProvider(rpcUrl);
        await this.reloadContracts();
        this.rpcChanged$.publish(newProvider.connection.url);
        this.provider = newProvider;
    }
    /**
     * Changes the ethereum account on behalf of which this {@link EthConnection} sends transactions. Reloads
     * the contracts.
     */
    async setAccount(skey) {
        this.signer = new ethers_1.Wallet(skey, this.provider);
        this.balance = await this.loadBalance(this.signer.address);
        await this.reloadContracts();
    }
    async refreshBalance() {
        if (this.signer) {
            const balance = await this.loadBalance(this.signer.address);
            this.balance = balance;
            this.myBalance$.publish(balance);
        }
    }
    /**
     * Loads gas prices from xDai.
     */
    async refreshGasPrices() {
        var _a;
        this.gasPrices = await xDaiApi_1.getAutoGasPrices();
        this.gasPrices$.publish(this.gasPrices);
        (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => (d.gasPrices = this.gasPrices));
    }
    /**
     * Gets a copy of the latest gas prices.
     */
    getAutoGasPrices() {
        return { ...this.gasPrices };
    }
    /**
     * Get the gas price, measured in Gwei, that we should send given the current prices for
     * transaction speeds, and given the user's gas price setting.
     */
    getAutoGasPriceGwei(gasPrices, gasPriceSetting // either auto or the gas price measured in gwei
    ) {
        // if the gas price setting represents an 'auto' choice, return that choice's current price
        const autoPrice = Network_1.getGasSettingGwei(gasPriceSetting, gasPrices);
        if (autoPrice !== undefined) {
            return autoPrice;
        }
        // if the gas price setting is not an auto choice, it is a string representing the user's
        // preferred gas price, measured in gwei.
        const parsedSetting = parseFloat(gasPriceSetting);
        if (!isNaN(parsedSetting)) {
            return parsedSetting;
        }
        // if the setting has become corrupted, just return an average gas price
        return gasPrices.average;
    }
    getRpcEndpoint() {
        return this.provider.connection.url;
    }
    hasSigner() {
        return !!this.signer;
    }
    subscribeToContractEvents(contract, 
    // map from contract event to function. using type 'any' here to satisfy typescript - each of
    // the functions has a different type signature.
    handlers, eventFilter) {
        const debouncedOnNewBlock = just_debounce_1.default(this.onNewBlock.bind(this), 1000, true, true);
        this.provider.on('block', async (latestBlockNumber) => {
            debouncedOnNewBlock(latestBlockNumber, contract, handlers, eventFilter);
        });
    }
    /**
     * Whenever we become aware of the fact that there have been one or more new blocks mined on the
     * blockchain, we need to update the internal game state of the game to reflect everything that
     * has happnened in those blocks. The way we find out what happened during those blocks is by
     * filtering all the events that have occured in those blocks to those that represent the various
     * actions that can occur on the game.
     */
    onNewBlock(latestBlockNumber, contract, handlers, eventFilter) {
        const previousBlockNumber = this.blockNumber;
        this.blockNumber = latestBlockNumber;
        this.blockNumber$.publish(latestBlockNumber);
        console.log(`processing events for ${latestBlockNumber - previousBlockNumber} blocks`);
        this.processEvents(Math.min(previousBlockNumber + 1, latestBlockNumber), latestBlockNumber, eventFilter, contract, handlers);
    }
    /**
     * Downloads and processes all the events that have occurred in the given range of blocks.
     *
     * @param startBlock inclusive
     * @param endBlock inclusive
     */
    async processEvents(startBlock, endBlock, eventFilter, contract, 
    // map from contract event name to the handler for that contract event
    handlers) {
        const logs = await this.provider.getLogs({
            fromBlock: startBlock,
            toBlock: endBlock,
            ...eventFilter,
        });
        logs.forEach((log) => {
            const parsedData = contract.interface.parseLog(log);
            const handler = handlers[parsedData.name];
            if (handler !== undefined) {
                handler(...parsedData.args);
            }
        });
    }
    /**
     * Returns the address of the signer, if one was set.
     */
    getAddress() {
        if (!this.signer) {
            return undefined;
        }
        return serde_1.address(this.signer.address);
    }
    /**
     * Returns the private key of the signer, if one was set.
     */
    getPrivateKey() {
        if (!this.signer) {
            return undefined;
        }
        return this.signer.privateKey;
    }
    /**
     * Gets the signer's nonce, or `0`.
     */
    async getNonce() {
        if (!this.signer) {
            return 0;
        }
        return Network_1.callWithRetry(this.provider.getTransactionCount.bind(this.provider), [
            this.signer.address,
        ]);
    }
    /**
     * Signs a string, or throws an error if a signer has not been set.
     */
    async signMessage(message) {
        if (!this.signer) {
            throw new Error('no signer was set.');
        }
        return this.signer.signMessage(message);
    }
    /**
     * Gets the balance of the given address (player or contract) measured in Wei. Wei is the base
     * unit in which amounts of Ether and xDai are measured.
     *
     * @see https://ethdocs.org/en/latest/ether.html#denominations
     */
    async loadBalance(address) {
        return await Network_1.callWithRetry(this.provider.getBalance.bind(this.provider), [address]);
    }
    /**
     * Sends a transaction on behalf of the account that can be set via
     * {@link EthConnection.setAccount}. Throws an error if no account was set.
     */
    sendTransaction(request) {
        if (!this.signer)
            throw new Error(`no signer`);
        return this.signer.sendTransaction(request);
    }
    /**
     * Gets the provider this {@link EthConnection} is currently using. Don't store a reference to
     * this (unless you're writing plugins), as the provider can change.
     */
    getProvider() {
        return this.provider;
    }
    /**
     * Gets the wallet, which represents the account that this {@link EthConnection} sends
     * transactions on behalf of.
     */
    getSigner() {
        return this.signer;
    }
    /**
     * Gets the current balance of the burner wallet this {@link EthConnection} is in charge of.
     */
    getMyBalance() {
        return this.balance;
    }
    /**
     * Returns a promise that resolves when the transaction with the given hash is confirmed, and
     * rejects if the transaction reverts or if there's a network error.
     */
    waitForTransaction(txHash) {
        return Network_1.waitForTransaction(this.provider, txHash);
    }
    /**
     * For collecting diagnostics.
     */
    setDiagnosticUpdater(diagnosticUpdater) {
        this.diagnosticsUpdater = diagnosticUpdater;
        this.rpcChanged$.subscribe(() => {
            diagnosticUpdater === null || diagnosticUpdater === void 0 ? void 0 : diagnosticUpdater.updateDiagnostics((diagnostics) => (diagnostics.rpcUrl = this.getRpcEndpoint()));
        });
        this.gasPrices$.subscribe((gasPrices) => {
            diagnosticUpdater === null || diagnosticUpdater === void 0 ? void 0 : diagnosticUpdater.updateDiagnostics((diagnostics) => (diagnostics.gasPrices = gasPrices));
        });
    }
    /**
     * Cleans up any important handles.
     */
    destroy() {
        this.stopPolling();
    }
    stopPolling() {
        if (this.gasPricesInterval) {
            clearInterval(this.gasPricesInterval);
        }
        if (this.balanceInterval) {
            clearInterval(this.balanceInterval);
        }
    }
    /**
     * Kicks off an interval that regularly reloads the gas prices from xDai.
     */
    startPolling() {
        this.refreshGasPrices();
        this.gasPricesInterval = setInterval(this.refreshGasPrices.bind(this), constants_1.GAS_PRICES_INTERVAL_MS);
        this.refreshBalance();
        this.balanceInterval = setInterval(this.refreshBalance.bind(this), 1000 * 10);
    }
}
exports.EthConnection = EthConnection;
async function createEthConnection(rpcUrl) {
    const provider = await Network_1.makeProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    return new EthConnection(provider, blockNumber);
}
exports.createEthConnection = createEthConnection;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXRoQ29ubmVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9FdGhDb25uZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHlEQUF1RjtBQUN2RixtREFBZ0U7QUFDaEUsaURBQWdEO0FBUWhELG1DQUFrRTtBQUNsRSxrRUFBcUM7QUFFckMsdUNBQStGO0FBQy9GLHVDQUE2QztBQUU3Qyx1REFBdUQ7QUFFdkQ7Ozs7R0FJRztBQUNILE1BQWEsYUFBYTtJQWlGeEIsWUFBbUIsUUFBeUIsRUFBRSxXQUFtQjtRQTFDakU7OztXQUdHO1FBQ0ssY0FBUyxHQUFjLDhCQUFrQixDQUFDO1FBdUNoRCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7UUFDM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxPQUFPLEdBQUcsa0JBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLFlBQVksR0FBRyxtQkFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxXQUFXLEdBQUcsbUJBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFHLG1CQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxtQkFBVSxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlO1FBQzNCLEtBQUssTUFBTSxD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