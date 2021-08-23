import { DiagnosticUpdater } from '@darkforest_eth/types';
import { ContractFunction } from 'ethers';
import { Queue } from './ThrottledConcurrentQueue';
/**
 * Instead of allowing the game to call `view` functions on the blockchain directly, all contract
 * calls should go through this class. Its purpose is to throttle the calls to a reasonable rate,
 * and to gracefully handle errors and retries
 */
export declare class ContractCaller {
    /**
     * Queue which stores future contract calls.
     */
    private readonly queue;
    /**
     * The maximum amount of times that we want the game to retry any individual call. Retries are
     * appended to the end of the queue, meaning they respect the throttling settings of this class.
     */
    private maxRetries;
    /**
     * Allows us to update the data that might be displayed in the UI.
     */
    private diagnosticsUpdater?;
    constructor(queue?: Queue, maxRetries?: number);
    /**
     * Submits a call to the call queue. Each call is retried a maximum of
     * {@link ContractCaller.DEFAULT_MAX_CALL_RETRIES} times. Returns a promise that resolves if the call was
     * successful, and rejects if it failed even after all the retries.
     */
    makeCall<T>(contractViewFunction: ContractFunction<T>, args?: unknown[]): Promise<T>;
    /**
     * Sets the diagnostics updater to the one you provide. If you don't set this, everything apart
     * from diagnostics continues to function.
     */
    setDiagnosticUpdater(diagnosticUpdater?: DiagnosticUpdater): void;
}
