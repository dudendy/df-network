"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAutoGasPrices = void 0;
const constants_1 = require("@darkforest_eth/constants");
/**
 * Gets the current gas prices from xDai's price oracle. If the oracle is broken, return some sane
 * defaults.
 */
async function getAutoGasPrices() {
    try {
        const res = await fetch(constants_1.GAS_PRICE_API, {
            method: 'GET',
        });
        const prices = (await res.json());
        cleanGasPrices(prices);
        return prices;
    }
    catch (e) {
        return constants_1.DEFAULT_GAS_PRICES;
    }
}
exports.getAutoGasPrices = getAutoGasPrices;
/**
 * In case xDai gives us a malformed response, clean it up with some default gas prices.
 */
function cleanGasPrices(gasPrices) {
    if (typeof gasPrices.fast !== 'number') {
        gasPrices.fast = constants_1.DEFAULT_GAS_PRICES.fast;
    }
    if (typeof gasPrices.average !== 'number') {
        gasPrices.average = constants_1.DEFAULT_GAS_PRICES.average;
    }
    if (typeof gasPrices.slow !== 'number') {
        gasPrices.slow = constants_1.DEFAULT_GAS_PRICES.slow;
    }
    gasPrices.fast = Math.max(1, Math.min(constants_1.MAX_AUTO_GAS_PRICE_GWEI, gasPrices.fast));
    gasPrices.average = Math.max(1, Math.min(constants_1.MAX_AUTO_GAS_PRICE_GWEI, gasPrices.average));
    gasPrices.slow = Math.max(1, Math.min(constants_1.MAX_AUTO_GAS_PRICE_GWEI, gasPrices.slow));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieERhaUFwaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy94RGFpQXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUltQztBQUduQzs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsZ0JBQWdCO0lBQ3BDLElBQUk7UUFDRixNQUFNLEdBQUcsR0FBRyxNQUFNLEtBQUssQ0FBQyx5QkFBYSxFQUFFO1lBQ3JDLE1BQU0sRUFBRSxLQUFLO1NBQ2QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBYyxDQUFDO1FBQy9DLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QixPQUFPLE1BQU0sQ0FBQztLQUNmO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixPQUFPLDhCQUFrQixDQUFDO0tBQzNCO0FBQ0gsQ0FBQztBQVpELDRDQVlDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGNBQWMsQ0FBQyxTQUFvQjtJQUMxQyxJQUFJLE9BQU8sU0FBUyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDdEMsU0FBUyxDQUFDLElBQUksR0FBRyw4QkFBa0IsQ0FBQyxJQUFJLENBQUM7S0FDMUM7SUFFRCxJQUFJLE9BQU8sU0FBUyxDQUFDLE9BQU8sS0FBSyxRQUFRLEVBQUU7UUFDekMsU0FBUyxDQUFDLE9BQU8sR0FBRyw4QkFBa0IsQ0FBQyxPQUFPLENBQUM7S0FDaEQ7SUFFRCxJQUFJLE9BQU8sU0FBUyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDdEMsU0FBUyxDQUFDLElBQUksR0FBRyw4QkFBa0IsQ0FBQyxJQUFJLENBQUM7S0FDMUM7SUFFRCxTQUFTLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsbUNBQXVCLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDaEYsU0FBUyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLG1DQUF1QixFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3RGLFNBQVMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxtQ0FBdUIsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNsRixDQUFDIn0=