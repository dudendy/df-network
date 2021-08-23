"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractCaller = void 0;
const constants_1 = require("@darkforest_eth/constants");
const p_retry_1 = __importDefault(require("p-retry"));
const ThrottledConcurrentQueue_1 = require("./ThrottledConcurrentQueue");
/**
 * Instead of allowing the game to call `view` functions on the blockchain directly, all contract
 * calls should go through this class. Its purpose is to throttle the calls to a reasonable rate,
 * and to gracefully handle errors and retries
 */
class ContractCaller {
    constructor(queue, maxRetries) {
        /**
         * Queue which stores future contract calls.
         */
        this.queue = new ThrottledConcurrentQueue_1.ThrottledConcurrentQueue(10, 100, 20);
        /**
         * The maximum amount of times that we want the game to retry any individual call. Retries are
         * appended to the end of the queue, meaning they respect the throttling settings of this class.
         */
        this.maxRetries = constants_1.DEFAULT_MAX_CALL_RETRIES;
        if (queue)
            this.queue = queue;
        if (maxRetries)
            this.maxRetries = maxRetries;
    }
    /**
     * Submits a call to the call queue. Each call is retried a maximum of
     * {@link ContractCaller.DEFAULT_MAX_CALL_RETRIES} times. Returns a promise that resolves if the call was
     * successful, and rejects if it failed even after all the retries.
     */
    async makeCall(contractViewFunction, args = []) {
        var _a;
        const result = p_retry_1.default(async () => {
            var _a, _b;
            (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => {
                d.totalCalls++;
            });
            (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => {
                d.callsInQueue = this.queue.size();
            });
            const callResult = await contractViewFunction(...args);
            (_b = this.diagnosticsUpdater) === null || _b === void 0 ? void 0 : _b.updateDiagnostics((d) => {
                d.callsInQueue = this.queue.size();
            });
            return callResult;
        }, { retries: this.maxRetries });
        (_a = this.diagnosticsUpdater) === null || _a === void 0 ? void 0 : _a.updateDiagnostics((d) => {
            d.totalCalls++;
        });
        return result;
    }
    /**
     * Sets the diagnostics updater to the one you provide. If you don't set this, everything apart
     * from diagnostics continues to function.
     */
    setDiagnosticUpdater(diagnosticUpdater) {
        this.diagnosticsUpdater = diagnosticUpdater;
    }
}
exports.ContractCaller = ContractCaller;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29udHJhY3RDYWxsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQ29udHJhY3RDYWxsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEseURBQXFFO0FBR3JFLHNEQUE0QjtBQUM1Qix5RUFBNkU7QUFFN0U7Ozs7R0FJRztBQUNILE1BQWEsY0FBYztJQWlCekIsWUFBbUIsS0FBYSxFQUFFLFVBQW1CO1FBaEJyRDs7V0FFRztRQUNjLFVBQUssR0FBVSxJQUFJLG1EQUF3QixDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFM0U7OztXQUdHO1FBQ0ssZUFBVSxHQUFXLG9DQUF3QixDQUFDO1FBUXBELElBQUksS0FBSztZQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQzlCLElBQUksVUFBVTtZQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO0lBQy9DLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLFFBQVEsQ0FDbkIsb0JBQXlDLEVBQ3pDLE9BQWtCLEVBQUU7O1FBRXBCLE1BQU0sTUFBTSxHQUFHLGlCQUFLLENBQ2xCLEtBQUssSUFBSSxFQUFFOztZQUNULE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRTs7Z0JBQ3RDLE1BQUEsSUFBSSxDQUFDLGtCQUFrQiwwQ0FBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO29CQUMvQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2pCLENBQUMsQ0FBQyxDQUFDO2dCQUNILE9BQU8sb0JBQW9CLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUN2QyxDQUFDLENBQUMsQ0FBQztZQUVILE1BQUEsSUFBSSxDQUFDLGtCQUFrQiwwQ0FBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUMvQyxDQUFDLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDckMsQ0FBQyxDQUFDLENBQUM7WUFFSCxNQUFNLFVBQVUsR0FBRyxNQUFNLFdBQVcsQ0FBQztZQUVyQyxNQUFBLElBQUksQ0FBQyxrQkFBa0IsMENBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtnQkFDL0MsQ0FBQyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3JDLENBQUMsQ0FBQyxDQUFDO1lBRUgsT0FBTyxVQUFVLENBQUM7UUFDcEIsQ0FBQyxFQUNELEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FDN0IsQ0FBQztRQUVGLE1BQUEsSUFBSSxDQUFDLGtCQUFrQiwwQ0FBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQy9DLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7O09BR0c7SUFDSSxvQkFBb0IsQ0FBQyxpQkFBcUM7UUFDL0QsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDO0lBQzlDLENBQUM7Q0FDRjtBQXJFRCx3Q0FxRUMifQ==