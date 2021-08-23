import { AutoGasSetting, DiagnosticUpdater } from '@darkforest_eth/types';
import { Contract, providers } from 'ethers';
import { EthConnection } from './EthConnection';
/**
 * Returns either a string that represents the gas price we should use by default for transactions,
 * or a string that represents the fact that we should be using one of the automatic gas prices.
 */
export declare type GasPriceSettingProvider = () => AutoGasSetting | string;
/**
 * {@link TxExecutor} calls this before executing a function to determine whether or not that
 * function should execute. If this function throws, the transaction is cancelled.
 */
export declare type BeforeTransaction = (transactionRequest: QueuedTransaction) => Promise<void>;
/**
 * {@link TxExecutor} calls this after executing a transaction.
 */
export declare type AfterTransaction = (transactionRequest: QueuedTransaction, performanceMetrics: unknown) => Promise<void>;
/**
 * Represents a transaction that the game would like to submit to the blockchain.
 */
export interface QueuedTransaction {
    /**
     * Uniquely identifies this transaction. Invariant throughout the entire life of a transaction,
     * from the moment the game conceives of taking that action, to the moment that it finishes either
     * successfully or with an error.
     */
    actionId: string;
    /**
     * Called if there was an error submitting this transaction.
     */
    onSubmissionError: (e: Error | undefined) => void;
    /**
     * Called if there was an error waiting for this transaction to complete.
     */
    onReceiptError: (e: Error | undefined) => void;
    /**
     * Called when the transaction was successfully submitted to the mempool.
     */
    onTransactionResponse: (e: providers.TransactionResponse) => void;
    /**
     * Called when the transaction successfully completes.
     */
    onTransactionReceipt: (e: providers.TransactionReceipt) => void;
    /**
     * The contract on which to execute this transaction.
     */
    contract: Contract;
    /**
     * The name of the contract method to execute.
     */
    methodName: string;
    /**
     * The arguments we should pass to the method we're executing.
     */
    args: unknown[];
    /**
     * Allows the submitter of the transaction to override some low-level blockchain transaction
     * settings, such as the gas price.
     */
    overrides: providers.TransactionRequest;
}
/**
 * Represents a transaction that is in flight.
 */
export interface PendingTransaction {
    /**
     * Resolves or rejects depending on the success or failure of this transaction to get into the
     * mempool. If this rejects, {@link PendingTransaction.confirmed} neither rejects nor resolves.
     */
    submitted: Promise<providers.TransactionResponse>;
    /**
     * Resolves or rejects depending on the success or failure of this transaction to execute.
     */
    confirmed: Promise<providers.TransactionReceipt>;
}
export declare class TxExecutor {
    /**
     * A transaction is considered to have errored if haven't successfully submitted to mempool within
     * this amount of time.
     */
    private static readonly TX_SUBMIT_TIMEOUT;
    /**
     * We refresh the nonce if it hasn't been updated in this amount of time.
     */
    private static readonly NONCE_STALE_AFTER_MS;
    /**
     * Our interface to the blockchain.
     */
    private readonly ethConnection;
    /**
     * Communicates to the {@link TxExecutor} the gas price we should be paying for each transaction,
     * if there is not a manual gas price specified for that transaction.
     */
    private readonly gasSettingProvider;
    /**
     * If present, called before every transaction, to give the user of {@link TxExecutor} the
     * opportunity to cancel the event by throwing an exception. Useful for interstitials.
     */
    private readonly beforeTransaction?;
    /**
     * If present, called after every transaction with the transaction info as well as its performance
     * metrics.
     */
    private readonly afterTransaction?;
    /**
     * Task queue which executes transactions in a controlled manner.
     */
    private readonly queue;
    /**
     * We record the last transaction timestamp so that we know when it's a good time to refresh the
     * nonce.
     */
    private lastTransactionTimestamp;
    /**
     * All Ethereum transactions have a nonce. The nonce should strictly increase with each
     * transaction.
     */
    private nonce;
    /**
     * Allows us to record some diagnostics that appear in the DiagnosticsPane of the Dark Forest client.
     */
    private diagnosticsUpdater?;
    /**
     * Unless overridden, these are the default transaction options each blockchain transaction will
     * be sent with.
     */
    private defaultTxOptions;
    constructor(ethConnection: EthConnection, gasSettingProvider: GasPriceSettingProvider, beforeTransaction?: BeforeTransaction, afterTransaction?: AfterTransaction);
    /**
     * Schedules this transaction for execution.
     */
    queueTransaction(actionId: string, contract: Contract, methodName: string, args: unknown[], overrides?: providers.TransactionRequest): PendingTransaction;
    /**
     * If the nonce is probably stale, reload it from the blockchain.
     */
    private maybeUpdateNonce;
    /**
     * Executes the given queued transaction. This is a field rather than a method declaration on
     * purpose for `this` purposes.
     */
    private execute;
    setDiagnosticUpdater(diagnosticUpdater?: DiagnosticUpdater): void;
}
