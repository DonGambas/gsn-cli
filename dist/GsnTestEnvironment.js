"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GsnTestEnvironment = void 0;
const net_1 = __importDefault(require("net"));
const common_1 = require("@opengsn/common");
const CommandsLogic_1 = require("./CommandsLogic");
const KeyManager_1 = require("@opengsn/relay/dist/KeyManager");
const utils_1 = require("./utils");
const TxStoreManager_1 = require("@opengsn/relay/dist/TxStoreManager");
const RelayServer_1 = require("@opengsn/relay/dist/RelayServer");
const HttpServer_1 = require("@opengsn/relay/dist/HttpServer");
const RelayProvider_1 = require("@opengsn/provider/dist/RelayProvider");
const web3_1 = __importDefault(require("web3"));
const ServerConfigParams_1 = require("@opengsn/relay/dist/ServerConfigParams");
const ServerWinstonLogger_1 = require("@opengsn/logger/dist/ServerWinstonLogger");
const TransactionManager_1 = require("@opengsn/relay/dist/TransactionManager");
const GasPriceFetcher_1 = require("@opengsn/relay/dist/GasPriceFetcher");
const ReputationStoreManager_1 = require("@opengsn/relay/dist/ReputationStoreManager");
const ReputationManager_1 = require("@opengsn/relay/dist/ReputationManager");
class GsnTestEnvironmentClass {
    /**
     *
     * @param host:
     * @return
     */
    async deployGsn(host) {
        const _host = (0, utils_1.getNetworkUrl)(host);
        if (_host == null) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`startGsn: expected network (${(0, utils_1.supportedNetworks)().join("|")}) or url`);
        }
        const logger = (0, ServerWinstonLogger_1.createServerLogger)("error", "", "");
        const commandsLogic = new CommandsLogic_1.CommandsLogic(_host, logger, {});
        await commandsLogic.init();
        const from = await commandsLogic.findWealthyAccount();
        const deploymentResult = await commandsLogic.deployGsnContracts({
            from,
            burnAddress: common_1.constants.BURN_ADDRESS,
            devAddress: common_1.constants.BURN_ADDRESS,
            minimumTokenStake: 1,
            gasPrice: (1e9).toString(),
            gasLimit: 5000000,
            deployTestToken: true,
            deployPaymaster: true,
            skipConfirmation: true,
            penalizerConfiguration: common_1.defaultEnvironment.penalizerConfiguration,
            relayHubConfiguration: common_1.defaultEnvironment.relayHubConfiguration,
        });
        console.log("Deployed GSN", JSON.stringify(deploymentResult));
        if (deploymentResult.paymasterAddress != null) {
            const balance = await commandsLogic.fundPaymaster(from, deploymentResult.paymasterAddress, (0, common_1.ether)("1"));
            console.log("Naive Paymaster successfully funded, balance:", web3_1.default.utils.fromWei(balance));
        }
        return deploymentResult;
    }
    /**
     *
     * @param host:
     * @return
     */
    async startGsn(host, port) {
        var _a;
        await this.stopGsn();
        const _host = (0, utils_1.getNetworkUrl)(host);
        if (_host == null) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`startGsn: expected network (${(0, utils_1.supportedNetworks)().join("|")}) or url`);
        }
        const deploymentResult = await this.deployGsn(host);
        const logger = (0, ServerWinstonLogger_1.createServerLogger)("error", "", "");
        const commandsLogic = new CommandsLogic_1.CommandsLogic(_host, logger, {});
        await commandsLogic.init();
        const from = await commandsLogic.findWealthyAccount();
        const relayUrl = "http://127.0.0.1:" + port.toString();
        await this._runServer(_host, deploymentResult, from, relayUrl, port);
        if (this.httpServer == null) {
            throw new Error("Failed to run a local Relay Server");
        }
        const registerOptions = {
            // force using default (wrapped eth) token
            wrap: true,
            from,
            sleepMs: 100,
            sleepCount: 5,
            stake: "1",
            funds: (0, common_1.ether)("5"),
            relayUrl: relayUrl,
            gasPrice: (1e9).toString(),
            unstakeDelay: "15000",
        };
        const registrationResult = await commandsLogic.registerRelay(registerOptions);
        if (registrationResult.success) {
            console.log("In-process relay successfully registered:", JSON.stringify(registrationResult));
        }
        else {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Failed to fund relay: ${registrationResult.error} : ${(_a = registrationResult === null || registrationResult === void 0 ? void 0 : registrationResult.transactions) === null || _a === void 0 ? void 0 : _a.toString()}`);
        }
        await commandsLogic.waitForRelay(relayUrl);
        const config = {
            preferredRelays: [relayUrl],
            paymasterAddress: deploymentResult.paymasterAddress,
        };
        const provider = new web3_1.default.providers.HttpProvider(_host);
        const input = {
            provider,
            config,
        };
        const relayProvider = await RelayProvider_1.RelayProvider.newProvider(input).init();
        console.error("== startGSN: ready.");
        return {
            contractsDeployment: deploymentResult,
            relayProvider,
            relayUrl,
            httpServer: this.httpServer,
        };
    }
    /**
     * initialize a local relay
     * @private
     */
    async _resolveAvailablePort() {
        const server = net_1.default.createServer();
        await new Promise((resolve) => {
            // @ts-ignore
            server.listen(0, resolve);
        });
        const address = server.address();
        if (address == null || typeof address === "string") {
            throw new Error("Could not find available port");
        }
        const relayListenPort = address.port;
        server.close();
        return relayListenPort;
    }
    async stopGsn() {
        var _a;
        if (this.httpServer !== undefined) {
            this.httpServer.stop();
            this.httpServer.close();
            await ((_a = this.httpServer.relayService) === null || _a === void 0 ? void 0 : _a.transactionManager.txStoreManager.clearAll());
            this.httpServer = undefined;
        }
    }
    async _runServer(host, deploymentResult, from, relayUrl, port) {
        if (this.httpServer !== undefined) {
            return;
        }
        const logger = (0, ServerWinstonLogger_1.createServerLogger)("error", "", "");
        const managerKeyManager = new KeyManager_1.KeyManager(1);
        const workersKeyManager = new KeyManager_1.KeyManager(1);
        const txStoreManager = new TxStoreManager_1.TxStoreManager({ inMemory: true }, logger);
        const maxPageSize = Number.MAX_SAFE_INTEGER;
        const environment = common_1.defaultEnvironment;
        const contractInteractor = new common_1.ContractInteractor({
            provider: new web3_1.default.providers.HttpProvider(host),
            logger,
            maxPageSize,
            environment,
            deployment: deploymentResult,
        });
        await contractInteractor.init();
        const gasPriceFetcher = new GasPriceFetcher_1.GasPriceFetcher("", "", contractInteractor, logger);
        const reputationStoreManager = new ReputationStoreManager_1.ReputationStoreManager({ inMemory: true }, logger);
        const reputationManager = new ReputationManager_1.ReputationManager(reputationStoreManager, logger, { initialReputation: 10 });
        const relayServerDependencies = {
            logger,
            contractInteractor,
            gasPriceFetcher,
            txStoreManager,
            managerKeyManager,
            workersKeyManager,
            reputationManager,
        };
        const relayServerParams = {
            devMode: true,
            url: relayUrl,
            relayHubAddress: deploymentResult.relayHubAddress,
            ownerAddress: from,
            gasPriceFactor: 1,
            checkInterval: 50,
            refreshStateTimeoutBlocks: 1,
            runPaymasterReputations: true,
            logLevel: "error",
            workerTargetBalance: 1e18,
        };
        const transactionManager = new TransactionManager_1.TransactionManager(relayServerDependencies, (0, ServerConfigParams_1.configureServer)(relayServerParams));
        const backend = new RelayServer_1.RelayServer(relayServerParams, transactionManager, relayServerDependencies);
        await backend.init();
        this.httpServer = new HttpServer_1.HttpServer(port, logger, backend);
        this.httpServer.start();
    }
    /**
     * return deployment saved by "gsn start"
     * @param workdir
     * @param url - an Ethereum RPC API Node URL
     */
    async loadDeployment(url, workdir = "./build/gsn") {
        const deployment = (0, utils_1.loadDeployment)(workdir);
        const contractInteractor = new common_1.ContractInteractor({
            provider: new web3_1.default.providers.HttpProvider(url),
            logger: console,
            maxPageSize: Number.MAX_SAFE_INTEGER,
            environment: common_1.defaultEnvironment,
            deployment,
        });
        await contractInteractor.initDeployment(deployment);
        await contractInteractor._validateERC165InterfacesClient(true);
        await contractInteractor._validateERC165InterfacesRelay();
        const tokenAddress = deployment.managerStakeTokenAddress;
        if (tokenAddress != null &&
            !(0, common_1.isSameAddress)(tokenAddress, common_1.constants.ZERO_ADDRESS)) {
            const code = await contractInteractor.getCode(tokenAddress);
            if (code.length <= 2) {
                throw new Error(`No contract deployed for ERC-20 ManagerStakeTokenAddress at ${tokenAddress}`);
            }
        }
        return deployment;
    }
}
exports.GsnTestEnvironment = new GsnTestEnvironmentClass();
//# sourceMappingURL=GsnTestEnvironment.js.map