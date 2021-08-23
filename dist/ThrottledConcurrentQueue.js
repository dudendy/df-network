"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottledConcurrentQueue = void 0;
const circular_buffer_1 = __importDefault(require("mnemonist/circular-buffer"));
const p_defer_1 = __importDefault(require("p-defer"));
/**
 * A queue that executes promises with a max throughput, and optionally max
 * concurrency.
 */
class ThrottledConcurrentQueue {
    constructor(maxInvocationsPerIntervalMs, invocationIntervalMs, maxConcurrency = Number.POSITIVE_INFINITY) {
        /**
         * Queue of tasks to execute. Added to the front, popped off the back.
         */
        this.taskQueue = [];
        /**
         * Amount of tasks being executed right now.
         */
        this.concurrency = 0;
        if (maxInvocationsPerIntervalMs <= 0) {
            throw new Error('must allow at least one invocation per interval');
        }
        if (invocationIntervalMs <= 0) {
            throw new Error('invocation interval must be positive');
        }
        if (maxConcurrency <= 0) {
            throw new Error('max concurrency must be positive');
        }
        this.invocationIntervalMs = invocationIntervalMs;
        this.maxConcurrency = maxConcurrency;
        this.executionTimestamps = new circular_buffer_1.default(Array, maxInvocationsPerIntervalMs);
    }
    /**
     * Adds a task to be executed at some point in the future. Returns a promise that resolves when
     * the task finishes successfully, and rejects when there is an error.
     *
     * @param start a function that returns a promise representing the task
     */
    add(start) {
        const { resolve, reject, promise } = p_defer_1.default();
        this.taskQueue.unshift({
            resolve: resolve,
            reject,
            start,
        });
        setTimeout(() => {
            this.executeNextTasks();
        }, 0);
        return promise;
    }
    /**
     * Returns the amount of queued items, not including the ones that are being executed at this
     * moment.
     */
    size() {
        return this.taskQueue.length;
    }
    /**
     * Runs tasks until it's at either the throttle or concurrency limit. If there are more tasks to
     * be executed after that, schedules itself to execute again at the soonest possible moment.
     */
    async executeNextTasks() {
        this.deleteOutdatedExecutionTimestamps();
        const tasksToExecute = Math.min(this.throttleQuotaRemaining(), this.concurrencyQuotaRemaining(), this.taskQueue.length);
        for (let i = 0; i < tasksToExecute; i++) {
            this.next().then(this.executeNextTasks.bind(this));
        }
        const nextPossibleExecution = this.nextPossibleExecution();
        if (this.taskQueue.length > 0 && nextPossibleExecution) {
            if (this.executionTimeout) {
                clearTimeout(this.executionTimeout);
            }
            this.executionTimeout = setTimeout(this.executeNextTasks.bind(this), nextPossibleExecution);
        }
    }
    /**
     * Returns the soonest possible time from now we could execute another task without going over the
     * throttle limit.
     */
    nextPossibleExecution() {
        const oldestExecution = this.executionTimestamps.peekFirst();
        if (!oldestExecution || this.concurrencyQuotaRemaining() === 0) {
            return undefined;
        }
        return Date.now() - oldestExecution + this.invocationIntervalMs;
    }
    /**
     * At this moment, how many more tasks we could execute without exceeding the concurrency quota.
     */
    concurrencyQuotaRemaining() {
        return this.maxConcurrency - this.concurrency;
    }
    /**
     * At this moment, how many more tasks we could execute without exceeding the throttle quota.
     */
    throttleQuotaRemaining() {
        return this.executionTimestamps.capacity - this.executionTimestamps.size;
    }
    /**
     * Removes all task execution timestamps that are older than [[this.invocationIntervalMs]],
     * because those invocations have no bearing on whether or not we can execute another task.
     */
    deleteOutdatedExecutionTimestamps() {
        const now = Date.now();
        let oldestInvocation = this.executionTimestamps.peekFirst();
        while (oldestInvocation && oldestInvocation < now - this.invocationIntervalMs) {
            this.executionTimestamps.shift();
            oldestInvocation = this.executionTimestamps.peekFirst();
        }
    }
    /**
     * If there is a next task to execute, executes it. Records the time of execution in
     * [[executionTimestamps]]. Increments and decrements concurrency counter. Neither throttles nor
     * limits concurrency.
     */
    async next() {
        const task = this.taskQueue.pop();
        if (!task) {
            return;
        }
        this.executionTimestamps.push(Date.now());
        this.concurrency++;
        try {
            task.resolve(await task.start());
        }
        catch (e) {
            task.reject(e);
        }
        this.concurrency--;
    }
}
exports.ThrottledConcurrentQueue = ThrottledConcurrentQueue;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGhyb3R0bGVkQ29uY3VycmVudFF1ZXVlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1Rocm90dGxlZENvbmN1cnJlbnRRdWV1ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxnRkFBdUQ7QUFDdkQsc0RBQStCO0FBOEIvQjs7O0dBR0c7QUFDSCxNQUFhLHdCQUF3QjtJQW9DbkMsWUFDRSwyQkFBbUMsRUFDbkMsb0JBQTRCLEVBQzVCLGNBQWMsR0FBRyxNQUFNLENBQUMsaUJBQWlCO1FBM0IzQzs7V0FFRztRQUNLLGNBQVMsR0FBK0IsRUFBRSxDQUFDO1FBU25EOztXQUVHO1FBQ0ssZ0JBQVcsR0FBRyxDQUFDLENBQUM7UUFjdEIsSUFBSSwyQkFBMkIsSUFBSSxDQUFDLEVBQUU7WUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1NBQ3BFO1FBRUQsSUFBSSxvQkFBb0IsSUFBSSxDQUFDLEVBQUU7WUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1NBQ3pEO1FBRUQsSUFBSSxjQUFjLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztTQUNyRDtRQUVELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxvQkFBb0IsQ0FBQztRQUNqRCxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSx5QkFBYyxDQUFDLEtBQUssRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLEdBQUcsQ0FBSSxLQUF1QjtRQUNuQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxpQkFBUSxFQUFLLENBQUM7UUFFbkQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUM7WUFDckIsT0FBTyxFQUFFLE9BQStC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