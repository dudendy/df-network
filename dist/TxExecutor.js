"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxExecutor = void 0;
const p_defer_1 = __importDefault(require("p-defer"));
const p_timeout_1 = __importDefault(require("p-timeout"));
const Network_1 = require("./Network");
const ThrottledConcurrentQueue_1 = require("./ThrottledConcurrentQueue");
class TxExecutor {
    constructor(ethConnection, gasSettingProvider, beforeTransaction, afterTransaction) {
        /**
         * Unless overridden, these are the default transaction options each blockchain transaction will
         * be sent with.
         */
        this.defaultTxOptions = {
            gasLimit: 2000000,
        };
        /**
         * Executes the given queued transaction. This is a field rather than a method declaration on
         * purpose for `this` purposes.
         */
        this.execute = async (txRequest) => {
            var _a;
            let time_called = undefined;
            let error = undefined;
            let time_submitted = undefined;
            let time_confirmed = undefined;
            let time_errored = undefined;
            let tx_hash = undefined;
            const time_exec_called = Date.now();
            try {
                await this.maybeUpdateNonce();
                if (this.beforeTransaction) {
                    await this.beforeTransaction(txRequest);
                }
                const requestWithDefaults = Object.assign(JSON.parse(JSON.stringify(this.defaultTxOptions)), txRequest.overrides);
                time_called = Date.now();
                const submitted = await p_timeout_1.default(txRequest.contract[txRequest.methodName](...txRequest.args, {
                    ...requestWithDefaults,
                    nonce: this.nonce,
                }), TxExecutor.TX_SUBMIT_TIMEOUT, `tx request ${txRequest.actionId} failed to submit: timed out}`);
                time_submitted = Date.now();
                tx_hash = submitted.hash;
                if (this.nonce !== undefined) {
                    this.nonce += 1;
                }
                this.lastTransactionTimestamp = time_submitted;
                txRequest.onTransactionResponse(submitted);

                this.ethConnection.waitForTransaction(submitted.hash).then((confirmed) => {
                    time_confirmed = Date.now();
                    txRequest.onTransactionReceipt(confirmed);
            
                    if (confirmed.status !== 1) {
                      time_errored = time_confirmed;
                      error = new Error('transaction reverted');
                    }
                }).catch(txRequest.onReceiptError);
            }
            catch (e) {
                console.error(e);
                time_errored = Date.now();
                error = e;
                if (!time_submitted) {
                    txRequest.onSubmissionError(error);
                }
                else {
                    txRequest.onReceiptError(error);
                }
            }
            finally {
                (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => {
                    d.totalTransactions++;
                });
            }
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            const logEvent = {
                tx_to: txRequest.contract.address,
                tx_type: txRequest.methodName,
                time_exec_called,
                tx_hash,
            };
            if (time_called && time_submitted) {
                logEvent.wait_submit = time_submitted - time_called;
                if (time_confirmed) {
                    logEvent.wait_confirm = time_confirmed - time_called;
                }
            }
            if (error && time_errored) {
                logEvent.error = error.message || JSON.stringify(error);
                logEvent.wait_error = time_errored - time_exec_called;
                try {
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    if (error.body) {
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        logEvent.parsed_error = String.fromCharCode.apply(null, error.body || []);
                    }
                }
                catch (e) { }
            }
            logEvent.rpc_endpoint = this.ethConnection.getRpcEndpoint();
            logEvent.user_address = this.ethConnection.getAddress();
            this.afterTransaction && this.afterTransaction(txRequest, logEvent);
        };
        this.queue = new ThrottledConcurrentQueue_1.ThrottledConcurrentQueue(3, 100, 1);
        this.lastTransactionTimestamp = Date.now();
        this.ethConnection = ethConnection;
        this.gasSettingProvider = gasSettingProvider;
        this.beforeTransaction = beforeTransaction;
        this.afterTransaction = afterTransaction;
    }
    /**
     * Schedules this transaction for execution.
     */
    queueTransaction(actionId, contract, methodName, args, overrides = {
        gasPrice: undefined,
        gasLimit: 2000000,
    }) {
        var _a;
        (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => {
            d.transactionsInQueue++;
        });
        const { promise: submittedPromise, reject: rejectTxResponse, resolve: txResponse, } = p_defer_1.default();
        const { promise: receiptPromise, reject: rejectTxReceipt, resolve: txReceipt, } = p_defer_1.default();
        if (overrides.gasPrice === undefined) {
            overrides.gasPrice = Network_1.gweiToWei(this.ethConnection.getAutoGasPriceGwei(this.ethConnection.getAutoGasPrices(), this.gasSettingProvider()));
        }
        this.queue.add(() => {
            var _a;
            (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => {
                d.transactionsInQueue--;
            });
            return this.execute({
                methodName,
                actionId,
                contract,
                args,
                overrides,
                onSubmissionError: rejectTxResponse,
                onReceiptError: rejectTxReceipt,
                onTransactionResponse: txResponse,
                onTransactionReceipt: txReceipt,
            });
        });
        return {
            submitted: submittedPromise,
            confirmed: receiptPromise,
        };
    }
    /**
     * If the nonce is probably stale, reload it from the blockchain.
     */
    async maybeUpdateNonce() {
        if (this.nonce === undefined ||
            Date.now() - this.lastTransactionTimestamp > TxExecutor.NONCE_STALE_AFTER_MS) {
            const newNonce = await this.ethConnection.getNonce();
            if (newNonce !== undefined)
                this.nonce = newNonce;
        }
    }
    setDiagnosticUpdater(diagnosticUpdater) {
        this.diagnosticsUpdater = diagnosticUpdater;
    }
}
exports.TxExecutor = TxExecutor;
/**
 * A transaction is considered to have errored if haven't successfully submitted to mempool within
 * this amount of time.
 */
TxExecutor.TX_SUBMIT_TIMEOUT = 30000;
/**
 * We refresh the nonce if it hasn't been updated in this amount of time.
 */
TxExecutor.NONCE_STALE_AFTER_MS = 5000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHhFeGVjdXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9UeEV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUVBLHNEQUErQjtBQUMvQiwwREFBZ0M7QUFFaEMsdUNBQXNDO0FBQ3RDLHlFQUFzRTtBQTJGdEUsTUFBYSxVQUFVO0lBaUVyQixZQUNFLGFBQTRCLEVBQzVCLGtCQUEyQyxFQUMzQyxpQkFBcUMsRUFDckMsZ0JBQW1DO1FBWnJDOzs7V0FHRztRQUNLLHFCQUFnQixHQUFpQztZQUN2RCxRQUFRLEVBQUUsT0FBUztTQUNwQixDQUFDO1FBMkZGOzs7V0FHRztRQUNLLFlBQU8sR0FBRyxLQUFLLEVBQUUsU0FBNEIsRUFBRSxFQUFFOztZQUN2RCxJQUFJLFdBQVcsR0FBdUIsU0FBUyxDQUFDO1lBQ2hELElBQUksS0FBSyxHQUFzQixTQUFTLENBQUM7WUFDekMsSUFBSSxjQUFjLEdBQXVCLFNBQVMsQ0FBQztZQUNuRCxJQUFJLGNBQWMsR0FBdUIsU0FBUyxDQUFDO1lBQ25ELElBQUksWUFBWSxHQUF1QixTQUFTLENBQUM7WUFDakQsSUFBSSxPQUFPLEdBQXVCLFNBQVMsQ0FBQztZQUU1QyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUVwQyxJQUFJO2dCQUNGLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBRTlCLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO29CQUMxQixNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDekM7Z0JBRUQsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUN2QyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFDakQsU0FBUyxDQUFDLFNBQVMsQ0FDcEIsQ0FBQztnQkFFRixXQUFXLEdBQUcsSUFB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