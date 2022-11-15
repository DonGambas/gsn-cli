"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@opengsn/common");
const CommandsLogic_1 = require("../CommandsLogic");
const utils_1 = require("../utils");
const web3_utils_1 = require("web3-utils");
const CommandsWinstonLogger_1 = require("@opengsn/logger/dist/CommandsWinstonLogger");
const commander = (0, utils_1.gsnCommander)(['n', 'f', 'm', 'g'])
    .option('--relayUrl <url>', 'url to advertise the relayer', 'http://localhost:8090')
    .option('--stake <stake>', 'amount to stake for the relayer, in ETH', '1')
    .option('--unstakeDelay <delay>', 'seconds to wait between unregistering and withdrawing the stake', '15000')
    .option('--funds <funds>', 'amount to transfer to the relayer to pay for relayed transactions, in ETH', '2')
    .option('--sleep <sleep>', 'ms to sleep each time if waiting for RelayServer to set its owner', '10000')
    .option('--sleepCount <sleepCount>', 'number of times to sleep before timeout', '5')
    .option('-t, --token <address>', 'Token to be used as a stake, defaults to first registered token')
    .option('--wrap', 'Assume token is "Wrapped ETH". If its balance is not enough for stake, then deposit ETH into it.')
    .parse(process.argv);
(async () => {
    var _a;
    const host = (0, utils_1.getNetworkUrl)(commander.network);
    const mnemonic = (0, utils_1.getMnemonic)(commander.mnemonic);
    const logger = (0, CommandsWinstonLogger_1.createCommandsLogger)(commander.loglevel);
    const logic = await new CommandsLogic_1.CommandsLogic(host, logger, {
        managerStakeTokenAddress: commander.token
    }, mnemonic, commander.derivationPath, commander.derivationIndex, commander.privateKeyHex).init();
    const registerOptions = {
        sleepMs: parseInt(commander.sleep),
        sleepCount: parseInt(commander.sleepCount),
        from: (_a = commander.from) !== null && _a !== void 0 ? _a : await logic.findWealthyAccount(),
        token: commander.token,
        stake: commander.stake,
        wrap: commander.wrap,
        funds: (0, common_1.ether)(commander.funds),
        gasPrice: commander.gasPrice != null ? (0, web3_utils_1.toWei)(commander.gasPrice, 'gwei') : undefined,
        relayUrl: commander.relayUrl,
        unstakeDelay: commander.unstakeDelay
    };
    if (registerOptions.from == null) {
        console.error('Failed to find a wealthy "from" address');
        process.exit(1);
    }
    const result = await logic.registerRelay(registerOptions);
    if (result.success) {
        console.log('Relay registered successfully! Transactions:\n', result.transactions);
        process.exit(0);
    }
    else {
        console.error('Failed to register relay:', result.error, result);
        process.exit(1);
    }
})().catch(reason => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-relayer-register.js.map