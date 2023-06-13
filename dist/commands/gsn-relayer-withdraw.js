"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CommandsLogic_1 = require("../CommandsLogic");
const utils_1 = require("../utils");
const CommandsWinstonLogger_1 = require("@opengsn/logger/dist/CommandsWinstonLogger");
const KeyManager_1 = require("@opengsn/relay/dist/KeyManager");
const web3_utils_1 = require("web3-utils");
const common_1 = require("@opengsn/common");
const commander = (0, utils_1.gsnCommander)(['g'])
    .option('-k, --keystore-path <keystorePath>', 'relay manager keystore directory', process.cwd() + '/gsndata/manager/')
    .option('-s, --server-config <serverConfig>', 'server config file', process.cwd() + '/config/gsn-relay-config.json')
    .option('-b, --broadcast', 'broadcast tx after logging it to console', false)
    .option('-t, --target <address>', 'target address for withdraw (defaults to owner)')
    .option('-a, --eth-account-amount <ethAccountAmount>', 'withdraw from relay manager eth account balance, in eth')
    .option('-d, --hub-balance-amount <hubBalanceAmount>', 'withdraw from relay manager hub balance, in eth')
    .parse(process.argv);
(async () => {
    var _a, _b;
    const config = (0, utils_1.getServerConfig)(commander.serverConfig);
    const host = config.ethereumNodeUrl;
    const logger = (0, CommandsWinstonLogger_1.createCommandsLogger)(commander.loglevel);
    const logic = await new CommandsLogic_1.CommandsLogic(host, logger, { relayHubAddress: config.relayHubAddress }).init();
    const keystorePath = (0, utils_1.getKeystorePath)(commander.keystorePath);
    const keyManager = new KeyManager_1.KeyManager(1, keystorePath);
    if (commander.ethAccountAmount == null && commander.hubBalanceAmount == null) {
        await logic.displayManagerBalances(config, keyManager);
        return;
    }
    if (commander.ethAccountAmount != null && commander.hubBalanceAmount != null) {
        throw new Error('Must provide exactly one option of -d (--hub-deposit-amount) or -e (--eth-account-amount)');
    }
    const withdrawOptions = {
        withdrawAmount: (0, common_1.ether)((_a = commander.ethAccountAmount) !== null && _a !== void 0 ? _a : commander.hubBalanceAmount),
        keyManager,
        config,
        broadcast: commander.broadcast,
        withdrawTarget: commander.target,
        gasPrice: commander.gasPrice != null ? (0, web3_utils_1.toWei)(commander.gasPrice, 'gwei') : undefined,
        useAccountBalance: commander.ethAccountAmount != null
    };
    console.log(`Withdrawal amount is ${(0, web3_utils_1.fromWei)(withdrawOptions.withdrawAmount)}eth`);
    console.log('Should broadcast?', withdrawOptions.broadcast);
    console.log('Withdrawing to', (_b = withdrawOptions.withdrawTarget) !== null && _b !== void 0 ? _b : '(owner)');
    const result = await logic.withdrawToOwner(withdrawOptions);
    if (result.success) {
        if (withdrawOptions.broadcast) {
            console.log('Withdrew to owner successfully! Transactions:\n', result.transactions);
        }
        else {
            console.log('Running in view mode succeeded! Run again with --broadcast to send the transaction on-chain');
        }
        process.exit(0);
    }
    else {
        console.error('Failed to withdraw to owner:', result.error);
        process.exit(1);
    }
})().catch(reason => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-relayer-withdraw.js.map