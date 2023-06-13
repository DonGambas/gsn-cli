"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_1 = __importDefault(require("web3"));
const CommandsLogic_1 = require("../CommandsLogic");
const utils_1 = require("../utils");
const CommandsWinstonLogger_1 = require("@opengsn/logger/dist/CommandsWinstonLogger");
const commander = (0, utils_1.gsnCommander)(['h', 'n'])
    .option('--paymaster <address>', 'address of the paymaster contract')
    .parse(process.argv);
(async () => {
    const network = commander.network;
    const nodeURL = (0, utils_1.getNetworkUrl)(network);
    const hub = (0, utils_1.getRelayHubAddress)(commander.hub);
    const paymaster = (0, utils_1.getPaymasterAddress)(commander.paymaster);
    if (hub == null || paymaster == null) {
        throw new Error(`Contracts not found: hub: ${hub} paymaster: ${paymaster} `);
    }
    const logger = (0, CommandsWinstonLogger_1.createCommandsLogger)(commander.loglevel);
    const logic = new CommandsLogic_1.CommandsLogic(nodeURL, logger, { relayHubAddress: hub });
    await logic.init();
    const balance = await logic.getPaymasterBalance(paymaster);
    console.log(`Account ${paymaster} has a GSN balance of ${web3_1.default.utils.fromWei(balance)} ETH`);
})().catch(reason => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-paymaster-balance.js.map