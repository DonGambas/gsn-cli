"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const CommandsLogic_1 = require("../CommandsLogic");
const utils_1 = require("../utils");
const web3_utils_1 = require("web3-utils");
const CommandsWinstonLogger_1 = require("@opengsn/logger/dist/CommandsWinstonLogger");
const common_1 = require("@opengsn/common");
(0, utils_1.gsnCommander)(['n', 'f', 'm', 'g', 'l'])
    .option('-w, --workdir <directory>', 'relative work directory (defaults to build/gsn/)', 'build/gsn')
    .option('--forwarder <address>', 'address of forwarder deployed to the current network (optional; deploys new one by default)')
    .option('--stakeManager <address>', 'stakeManager')
    .option('--relayHub <address>', 'relayHub')
    .option('--penalizer <address>', 'penalizer')
    .option('--relayRegistrar <address>', 'relayRegistrar')
    .option('--environmentName <string>', `name of one of the GSN supported environments: (${Object.keys(common_1.EnvironmentsKeys).toString()}; default: ethereumMainnet)`, common_1.EnvironmentsKeys.ethereumMainnet)
    .requiredOption('--burnAddress <string>', 'address to transfer burned stake tokens into')
    .requiredOption('--devAddress <string>', 'address to transfer abandoned stake tokens into')
    .option('--stakingToken <string>', 'default staking token to use')
    .option('--minimumTokenStake <number>', 'minimum staking value', '1')
    .option('--yes, --skipConfirmation', 'skip confirmation message for deployment transaction')
    .option('--testToken', 'deploy test weth token', false)
    .option('--testPaymaster', 'deploy test paymaster (accepts everything, avoid on main-nets)', false)
    .option('-c, --config <path>', 'config JSON file to change the configuration of the RelayHub being deployed (optional)')
    .parse(process.argv);
(async () => {
    var _a, _b;
    const network = commander_1.default.network;
    const nodeURL = (0, utils_1.getNetworkUrl)(network);
    const environment = common_1.environments[commander_1.default.environmentName];
    if (environment == null) {
        throw new Error(`Unknown named environment: ${commander_1.default.environmentName}`);
    }
    console.log('Using environment: ', JSON.stringify(environment));
    const logger = (0, CommandsWinstonLogger_1.createCommandsLogger)(commander_1.default.loglevel);
    const mnemonic = (0, utils_1.getMnemonic)(commander_1.default.mnemonic);
    const relayHubConfiguration = (_a = (0, utils_1.getRelayHubConfiguration)(commander_1.default.config)) !== null && _a !== void 0 ? _a : environment.relayHubConfiguration;
    const penalizerConfiguration = environment.penalizerConfiguration;
    const logic = new CommandsLogic_1.CommandsLogic(nodeURL, logger, {}, mnemonic, commander_1.default.derivationPath, commander_1.default.derivationIndex, commander_1.default.privateKeyHex);
    const from = (_b = commander_1.default.from) !== null && _b !== void 0 ? _b : await logic.findWealthyAccount();
    const gasPrice = (0, web3_utils_1.toHex)(commander_1.default.gasPrice != null ? (0, web3_utils_1.toWei)(commander_1.default.gasPrice, 'gwei').toString() : await logic.getGasPrice());
    const gasLimit = commander_1.default.gasLimit;
    if (commander_1.default.testToken === (commander_1.default.stakingToken != null)) {
        throw new Error('must specify either --testToken or --stakingToken');
    }
    const deploymentResult = await logic.deployGsnContracts({
        from,
        gasPrice,
        gasLimit,
        relayHubConfiguration,
        penalizerConfiguration,
        stakingTokenAddress: commander_1.default.stakingToken,
        minimumTokenStake: commander_1.default.minimumTokenStake,
        deployPaymaster: commander_1.default.testPaymaster,
        deployTestToken: commander_1.default.testToken,
        verbose: true,
        skipConfirmation: commander_1.default.skipConfirmation,
        forwarderAddress: commander_1.default.forwarder,
        stakeManagerAddress: commander_1.default.stakeManager,
        relayHubAddress: commander_1.default.relayHub,
        penalizerAddress: commander_1.default.penalizer,
        relayRegistryAddress: commander_1.default.relayRegistrar,
        burnAddress: commander_1.default.burnAddress,
        devAddress: commander_1.default.devAddress
    });
    const paymasterName = 'Default';
    (0, utils_1.showDeployment)(deploymentResult, `Deployed GSN to network: ${network}`, paymasterName);
    (0, utils_1.saveDeployment)(deploymentResult, commander_1.default.workdir);
    process.exit(0);
})().catch(reason => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-deploy.js.map