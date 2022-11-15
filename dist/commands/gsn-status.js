"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_1 = __importDefault(require("web3"));
const clear_1 = __importDefault(require("clear"));
const common_1 = require("@opengsn/common");
const utils_1 = require("../utils");
const StatisticsManager_1 = require("@opengsn/common/dist/statistics/StatisticsManager");
const CommandsWinstonLogger_1 = require("@opengsn/logger/dist/CommandsWinstonLogger");
const CommandLineStatisticsPresenter_1 = require("../CommandLineStatisticsPresenter");
const CommandLineStatisticsPresenterConfig_1 = require("../CommandLineStatisticsPresenterConfig");
const commander = (0, utils_1.gsnCommander)(['n', 'h'])
    .parse(process.argv);
(async () => {
    const host = (0, utils_1.getNetworkUrl)(commander.network);
    const relayHubAddress = (0, utils_1.getRelayHubAddress)(commander.hub);
    if (relayHubAddress == null) {
        console.error('Please specify RelayHub address');
        process.exit(1);
    }
    const deployment = { relayHubAddress };
    const logger = (0, CommandsWinstonLogger_1.createCommandsLogger)(commander.loglevel);
    const provider = new web3_1.default.providers.HttpProvider(host);
    const maxPageSize = Number.MAX_SAFE_INTEGER;
    const environment = common_1.defaultEnvironment;
    const contractInteractor = new common_1.ContractInteractor({ provider, logger, deployment, maxPageSize, environment });
    await contractInteractor.init();
    const timeout = 1000;
    const httpClient = new common_1.HttpClient(new common_1.HttpWrapper({ timeout }), logger);
    const statusLogic = new StatisticsManager_1.StatisticsManager(contractInteractor, httpClient, logger);
    const statistics = await statusLogic.gatherStatistics();
    const blockExplorerUrl = utils_1.networksBlockExplorers.get(commander.network);
    const presenterConfig = Object.assign({}, CommandLineStatisticsPresenterConfig_1.defaultCommandLineStatisticsPresenterConfig, { blockExplorerUrl });
    const statisticsStringPresentation = new CommandLineStatisticsPresenter_1.CommandLineStatisticsPresenter(presenterConfig)
        .getStatisticsStringPresentation(statistics);
    (0, clear_1.default)();
    console.log(statisticsStringPresentation);
})().catch(reason => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-status.js.map