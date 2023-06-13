"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandsLogic = void 0;
// @ts-ignore
const console_read_write_1 = __importDefault(require("console-read-write"));
const bn_js_1 = __importDefault(require("bn.js"));
const hdwallet_provider_1 = __importDefault(require("@truffle/hdwallet-provider"));
const web3_1 = __importDefault(require("web3"));
const web3_utils_1 = require("web3-utils");
const ow_1 = __importDefault(require("ow"));
const common_1 = require("@opengsn/common");
// compiled folder populated by "preprocess"
const StakeManager_json_1 = __importDefault(require("./compiled/StakeManager.json"));
const RelayHub_json_1 = __importDefault(require("./compiled/RelayHub.json"));
const RelayRegistrar_json_1 = __importDefault(require("./compiled/RelayRegistrar.json"));
const Penalizer_json_1 = __importDefault(require("./compiled/Penalizer.json"));
const TestPaymasterEverythingAccepted_json_1 = __importDefault(require("./compiled/TestPaymasterEverythingAccepted.json"));
const Forwarder_json_1 = __importDefault(require("./compiled/Forwarder.json"));
const TestWrappedNativeToken_json_1 = __importDefault(require("./compiled/TestWrappedNativeToken.json"));
const tx_1 = require("@ethereumjs/tx");
const provider_1 = require("@opengsn/provider");
/**
 * Must verify these parameters are passed to deploy script
 */
const DeployOptionsPartialShape = {
    from: ow_1.default.string,
    gasPrice: ow_1.default.string
};
class CommandsLogic {
    constructor(host, logger, deployment, mnemonic, derivationPath, derivationIndex = '0', privateKey) {
        let provider = new web3_1.default.providers.HttpProvider(host, {
            keepAlive: true,
            timeout: 120000
        });
        provider.sendAsync = provider.send.bind(provider);
        if (mnemonic != null || privateKey != null) {
            let hdWalletConstructorArguments;
            if (mnemonic != null) {
                const addressIndex = parseInt(derivationIndex);
                hdWalletConstructorArguments = {
                    mnemonic,
                    derivationPath,
                    addressIndex,
                    provider
                };
            }
            else {
                hdWalletConstructorArguments = {
                    privateKeys: [privateKey],
                    provider
                };
            }
            provider = new hdwallet_provider_1.default(hdWalletConstructorArguments);
            const hdWalletAddress = provider.getAddress();
            console.log(`Using HDWalletProvider for address ${hdWalletAddress}`);
        }
        this.httpClient = new common_1.HttpClient(new common_1.HttpWrapper(), logger);
        const maxPageSize = Number.MAX_SAFE_INTEGER;
        const environment = common_1.defaultEnvironment;
        this.contractInteractor = new common_1.ContractInteractor({ provider, logger, deployment, maxPageSize, environment });
        this.deployment = deployment;
        this.web3 = new web3_1.default(provider);
    }
    async init() {
        await this.contractInteractor.init();
        return this;
    }
    async findWealthyAccount(requiredBalance = (0, common_1.ether)('2')) {
        let accounts = [];
        try {
            accounts = await this.web3.eth.getAccounts();
            for (const account of accounts) {
                const balance = new bn_js_1.default(await this.web3.eth.getBalance(account));
                if (balance.gte(requiredBalance)) {
                    console.log(`Found funded account ${account}`);
                    return account;
                }
            }
        }
        catch (error) {
            console.error('Failed to retrieve accounts and balances:', error);
        }
        throw new Error(`could not find unlocked account with sufficient balance; all accounts:\n - ${accounts.join('\n - ')}`);
    }
    async isRelayReady(relayUrl) {
        const response = await this.httpClient.getPingResponse(relayUrl);
        return response.ready;
    }
    async waitForRelay(relayUrl, timeout = 60) {
        console.error(`Will wait up to ${timeout}s for the relay to be ready`);
        const endTime = Date.now() + timeout * 1000;
        while (Date.now() < endTime) {
            let isReady = false;
            try {
                isReady = await this.isRelayReady(relayUrl);
            }
            catch (e) {
                console.log(e.message);
            }
            if (isReady) {
                return;
            }
            await (0, common_1.sleep)(3000);
        }
        throw Error(`Relay not ready after ${timeout}s`);
    }
    async getPaymasterBalance(paymaster) {
        if (this.deployment == null) {
            throw new Error('Deployment is not initialized!');
        }
        return await this.contractInteractor.hubBalanceOf(paymaster);
    }
    /**
     * Send enough ether from the {@param from} to the RelayHub to make {@param paymaster}'s gas deposit exactly {@param amount}.
     * Does nothing if current paymaster balance exceeds amount.
     * @param from
     * @param paymaster
     * @param amount
     * @return deposit of the paymaster after
     */
    async fundPaymaster(from, paymaster, amount) {
        if (this.deployment == null) {
            throw new Error('Deployment is not initialized!');
        }
        const currentBalance = await this.contractInteractor.hubBalanceOf(paymaster);
        const targetAmount = new bn_js_1.default(amount);
        if (currentBalance.lt(targetAmount)) {
            const value = targetAmount.sub(currentBalance);
            await this.contractInteractor.hubDepositFor(paymaster, {
                value,
                from
            });
            return targetAmount;
        }
        else {
            return currentBalance;
        }
    }
    async registerRelay(options) {
        var _a;
        const transactions = [];
        try {
            console.log(`Registering GSN relayer at ${options.relayUrl}`);
            const gasPrice = (0, web3_utils_1.toHex)((_a = options.gasPrice) !== null && _a !== void 0 ? _a : (0, web3_utils_1.toBN)(await this.getGasPrice()));
            const sendOptions = {
                chainId: (0, web3_utils_1.toHex)(await this.web3.eth.getChainId()),
                from: options.from,
                gas: 1e6,
                gasPrice
            };
            const response = await this.httpClient.getPingResponse(options.relayUrl)
                .catch((error) => {
                console.error(error);
                throw new Error('could contact not relayer, is it running?');
            });
            if (response.ready) {
                return {
                    success: false,
                    error: 'Nothing to do. Relayer already registered'
                };
            }
            const chainId = this.contractInteractor.chainId;
            if (response.chainId !== chainId.toString()) {
                throw new Error(`wrong chain-id: Relayer on (${response.chainId}) but our provider is on (${chainId})`);
            }
            if (!(0, common_1.isSameAddress)(response.ownerAddress, options.from)) {
                throw new Error(`Relayer configured with wrong owner: ${response.ownerAddress}, our account: ${options.from}`);
            }
            const relayAddress = response.relayManagerAddress;
            const relayHubAddress = response.relayHubAddress;
            await this.contractInteractor._resolveDeploymentFromRelayHub(relayHubAddress);
            const relayHub = await this.contractInteractor.relayHubInstance;
            const stakeManagerAddress = await relayHub.getStakeManager();
            const stakeManager = await this.contractInteractor._createStakeManager(stakeManagerAddress);
            const { stake, unstakeDelay, owner, token } = (await stakeManager.getStakeInfo(relayAddress))[0];
            let stakingToken = options.token;
            if (stakingToken == null) {
                stakingToken = await this._findFirstToken(relayHubAddress);
            }
            if (!((0, common_1.isSameAddress)(token, stakingToken) || (0, common_1.isSameAddress)(token, common_1.constants.ZERO_ADDRESS))) {
                throw new Error(`Cannot use token ${stakingToken}. Relayer already uses token: ${token}`);
            }
            const stakingTokenContract = await this.contractInteractor._createERC20(stakingToken);
            const tokenDecimals = await stakingTokenContract.decimals();
            const tokenSymbol = await stakingTokenContract.symbol();
            const stakeParam = (0, web3_utils_1.toBN)((0, common_1.toNumber)(options.stake) * Math.pow(10, tokenDecimals.toNumber()));
            const formatToken = (val) => (0, common_1.formatTokenAmount)((0, web3_utils_1.toBN)(val.toString()), tokenDecimals, stakingToken !== null && stakingToken !== void 0 ? stakingToken : '', tokenSymbol);
            console.log('current stake= ', formatToken(stake));
            if (owner !== common_1.constants.ZERO_ADDRESS && !(0, common_1.isSameAddress)(owner, options.from)) {
                throw new Error(`Already owned by ${owner}, our account=${options.from}`);
            }
            const bal = await this.contractInteractor.getBalance(relayAddress);
            if ((0, web3_utils_1.toBN)(bal).gt((0, web3_utils_1.toBN)(options.funds.toString()))) {
                console.log('Relayer already funded');
            }
            else {
                console.log('Funding relayer');
                const fundTx = await this.web3.eth.sendTransaction(Object.assign(Object.assign({}, sendOptions), { to: relayAddress, value: options.funds }));
                if (fundTx.transactionHash == null) {
                    return {
                        success: false,
                        error: `Fund transaction reverted: ${JSON.stringify(fundTx)}`
                    };
                }
                transactions.push(fundTx.transactionHash);
            }
            if (owner === common_1.constants.ZERO_ADDRESS) {
                let i = 0;
                while (true) {
                    console.debug(`Waiting ${options.sleepMs}ms ${i}/${options.sleepCount} for relayer to set ${options.from} as owner`);
                    await (0, common_1.sleep)(options.sleepMs);
                    const newStakeInfo = (await stakeManager.getStakeInfo(relayAddress))[0];
                    if (newStakeInfo.owner !== common_1.constants.ZERO_ADDRESS && (0, common_1.isSameAddress)(newStakeInfo.owner, options.from)) {
                        console.log('RelayServer successfully set its owner on the StakeManager');
                        break;
                    }
                    if (options.sleepCount === i++) {
                        throw new Error('RelayServer failed to set its owner on the StakeManager');
                    }
                }
            }
            if (unstakeDelay.gte((0, web3_utils_1.toBN)(options.unstakeDelay)) &&
                stake.gte(stakeParam)) {
                console.log('Relayer already staked');
            }
            else {
                const config = await relayHub.getConfiguration();
                const minimumStakeForToken = await relayHub.getMinimumStakePerToken(stakingToken);
                if (minimumStakeForToken.gt((0, web3_utils_1.toBN)(stakeParam.toString()))) {
                    throw new Error(`Given stake ${formatToken(stakeParam)} too low for the given hub ${formatToken(minimumStakeForToken)} and token ${stakingToken}`);
                }
                if (minimumStakeForToken.eqn(0)) {
                    throw new Error(`Selected token (${stakingToken}) is not allowed in the current RelayHub`);
                }
                if (config.minimumUnstakeDelay.gt((0, web3_utils_1.toBN)(options.unstakeDelay))) {
                    throw new Error(`Given minimum unstake delay ${options.unstakeDelay.toString()} too low for the given hub ${config.minimumUnstakeDelay.toString()}`);
                }
                const stakeValue = stakeParam.sub(stake);
                console.log(`Staking relayer ${formatToken(stakeValue)}`, stake.toString() === '0' ? '' : ` (already has ${formatToken(stake)})`);
                const tokenBalance = await stakingTokenContract.balanceOf(options.from);
                if (tokenBalance.lt(stakeValue) && options.wrap) {
                    // default token is wrapped eth, so deposit eth to make then into tokens.
                    console.log(`Wrapping ${formatToken(stakeValue)}`);
                    let depositTx;
                    try {
                        depositTx = await stakingTokenContract.deposit(Object.assign(Object.assign({}, sendOptions), { from: options.from, value: stakeValue }));
                    }
                    catch (e) {
                        throw new Error('No deposit() method on default token. is it wrapped ETH?');
                    }
                    transactions.push(depositTx.transactionHash);
                }
                const currentAllowance = await stakingTokenContract.allowance(options.from, stakeManager.address);
                console.log('Current allowance', formatToken(currentAllowance));
                if (currentAllowance.lt(stakeValue)) {
                    console.log(`Approving ${formatToken(stakeValue)} to StakeManager`);
                    const approveTx = await stakingTokenContract.approve(stakeManager.address, stakeValue, Object.assign(Object.assign({}, sendOptions), { from: options.from }));
                    // @ts-ignore
                    transactions.push(approveTx.transactionHash);
                }
                const stakeTx = await stakeManager
                    .stakeForRelayManager(stakingToken, relayAddress, options.unstakeDelay.toString(), stakeValue, Object.assign({}, sendOptions));
                // @ts-ignore
                transactions.push(stakeTx.transactionHash);
            }
            try {
                await relayHub.verifyRelayManagerStaked(relayAddress);
                console.log('Relayer already authorized');
            }
            catch (e) {
                // hide expected error
                if (e.message.match(/not authorized/) == null) {
                    console.log('verifyRelayManagerStaked reverted with:', e.message);
                }
                console.log('Authorizing relayer for hub');
                const authorizeTx = await stakeManager
                    .authorizeHubByOwner(relayAddress, relayHubAddress, sendOptions);
                // @ts-ignore
                transactions.push(authorizeTx.transactionHash);
            }
            await this.waitForRelay(options.relayUrl);
            return {
                success: true,
                transactions
            };
        }
        catch (error) {
            console.log(error);
            return {
                success: false,
                transactions,
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                error: error.message
            };
        }
    }
    async _findFirstToken(relayHubAddress) {
        const relayHub = await this.contractInteractor._createRelayHub(relayHubAddress);
        const fromBlock = await relayHub.getCreationBlock();
        const toBlock = Math.min((0, common_1.toNumber)(fromBlock) + 5000, await this.contractInteractor.getBlockNumber());
        const tokens = await this.contractInteractor.getPastEventsForHub([], {
            fromBlock,
            toBlock
        }, ['StakingTokenDataChanged']);
        if (tokens.length === 0) {
            throw new Error(`no registered staking tokens on RelayHub ${relayHubAddress}`);
        }
        return tokens[0].returnValues.token;
    }
    async displayManagerBalances(config, keyManager) {
        const relayManager = keyManager.getAddress(0);
        console.log('relayManager is', relayManager);
        const relayHub = await this.contractInteractor._createRelayHub(config.relayHubAddress);
        const accountBalance = (0, web3_utils_1.toBN)(await this.contractInteractor.getBalance(relayManager));
        console.log(`Relay manager account balance is ${(0, web3_utils_1.fromWei)(accountBalance)}eth`);
        const hubBalance = await relayHub.balanceOf(relayManager);
        console.log(`Relay manager hub balance is ${(0, web3_utils_1.fromWei)(hubBalance)}eth`);
    }
    async withdrawToOwner(options) {
        var _a, _b;
        const transactions = [];
        try {
            const relayManager = options.keyManager.getAddress(0);
            console.log('relayManager is', relayManager);
            const relayHub = await this.contractInteractor._createRelayHub(options.config.relayHubAddress);
            const stakeManagerAddress = await relayHub.getStakeManager();
            const stakeManager = await this.contractInteractor._createStakeManager(stakeManagerAddress);
            const { owner } = (await stakeManager.getStakeInfo(relayManager))[0];
            if (options.config.ownerAddress != null) {
                // old (2.1.0) relayers didn't have owners in config.
                // but its OK to withdraw from them...
                if (owner.toLowerCase() !== options.config.ownerAddress.toLowerCase()) {
                    throw new Error(`Owner in relayHub ${owner} is different than in server config ${options.config.ownerAddress}`);
                }
            }
            const withdrawTarget = (_a = options.withdrawTarget) !== null && _a !== void 0 ? _a : owner;
            const nonce = await this.contractInteractor.getTransactionCount(relayManager);
            const gasPrice = (0, web3_utils_1.toHex)((_b = options.gasPrice) !== null && _b !== void 0 ? _b : (0, web3_utils_1.toBN)(await this.getGasPrice()));
            const gasLimit = 1e5;
            let txToSign;
            if (options.useAccountBalance) {
                const balance = (0, web3_utils_1.toBN)(await this.contractInteractor.getBalance(relayManager));
                console.log(`Relay manager account balance is ${(0, web3_utils_1.fromWei)(balance)}eth`);
                if (balance.lt(options.withdrawAmount)) {
                    throw new Error('Relay manager account balance lower than withdrawal amount');
                }
                const web3TxData = {
                    to: withdrawTarget,
                    value: options.withdrawAmount,
                    gas: gasLimit,
                    gasPrice,
                    nonce
                };
                console.log('Calling in view mode', web3TxData);
                await this.contractInteractor.web3.eth.call(Object.assign({}, web3TxData));
                const txData = Object.assign(Object.assign({}, web3TxData), { gasLimit: web3TxData.gas });
                // @ts-ignore
                delete txData.gas;
                txToSign = new tx_1.Transaction(txData, this.contractInteractor.getRawTxOptions());
            }
            else {
                const balance = await relayHub.balanceOf(relayManager);
                console.log(`Relay manager hub balance is ${(0, web3_utils_1.fromWei)(balance)}eth`);
                if (balance.lt(options.withdrawAmount)) {
                    throw new Error('Relay manager hub balance lower than withdrawal amount');
                }
                const method = relayHub.contract.methods.withdraw(withdrawTarget, options.withdrawAmount);
                const encodedCall = method.encodeABI();
                txToSign = new tx_1.Transaction({
                    to: options.config.relayHubAddress,
                    value: 0,
                    gasLimit,
                    gasPrice,
                    data: Buffer.from(encodedCall.slice(2), 'hex'),
                    nonce
                }, this.contractInteractor.getRawTxOptions());
                console.log('Calling in view mode');
                await method.call({
                    from: relayManager,
                    to: options.config.relayHubAddress,
                    value: 0,
                    gas: gasLimit,
                    gasPrice
                });
            }
            console.log('Signing tx', txToSign.toJSON());
            const signedTx = options.keyManager.signTransaction(relayManager, txToSign);
            console.log(`signed withdrawal hex tx: ${signedTx.rawTx}`);
            if (options.broadcast) {
                console.log('broadcasting tx');
                const txHash = await this.contractInteractor.broadcastTransaction(signedTx.rawTx);
                transactions.push(txHash);
            }
            return {
                success: true,
                transactions
            };
        }
        catch (e) {
            console.log(e);
            return {
                success: false,
                transactions,
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                error: e.message
            };
        }
    }
    contract(file, address) {
        var _a;
        const abi = (_a = file.abi) !== null && _a !== void 0 ? _a : file;
        return new this.web3.eth.Contract(abi, address, { data: file.bytecode });
    }
    async deployGsnContracts(deployOptions) {
        var _a, _b, _c;
        (0, ow_1.default)(deployOptions, ow_1.default.object.partialShape(DeployOptionsPartialShape));
        const options = {
            from: deployOptions.from,
            gas: deployOptions.gasLimit,
            value: 0,
            gasPrice: deployOptions.gasPrice
        };
        const rrInstance = await this.getContractInstance(RelayRegistrar_json_1.default, {
            arguments: [
                common_1.constants.yearInSec
            ]
        }, deployOptions.relayRegistryAddress, Object.assign({}, options), deployOptions.skipConfirmation);
        const sInstance = await this.getContractInstance(StakeManager_json_1.default, {
            arguments: [common_1.defaultEnvironment.maxUnstakeDelay, common_1.defaultEnvironment.abandonmentDelay, common_1.defaultEnvironment.escheatmentDelay, deployOptions.burnAddress, deployOptions.devAddress]
        }, deployOptions.stakeManagerAddress, Object.assign({}, options), deployOptions.skipConfirmation);
        const pInstance = await this.getContractInstance(Penalizer_json_1.default, {
            arguments: [
                deployOptions.penalizerConfiguration.penalizeBlockDelay,
                deployOptions.penalizerConfiguration.penalizeBlockExpiration
            ]
        }, deployOptions.penalizerAddress, Object.assign({}, options), deployOptions.skipConfirmation);
        const fInstance = await this.getContractInstance(Forwarder_json_1.default, {}, deployOptions.forwarderAddress, Object.assign({}, options), deployOptions.skipConfirmation);
        // TODO: add support to passing '--batchGatewayAddress'
        const batchGatewayAddress = common_1.constants.ZERO_ADDRESS;
        const rInstance = await this.getContractInstance(RelayHub_json_1.default, {
            arguments: [
                sInstance.options.address,
                pInstance.options.address,
                batchGatewayAddress,
                rrInstance.options.address,
                deployOptions.relayHubConfiguration
            ]
        }, deployOptions.relayHubAddress, Object.assign({}, options), deployOptions.skipConfirmation);
        if (!(0, common_1.isSameAddress)(await rInstance.methods.getRelayRegistrar().call(), rrInstance.options.address)) {
            await rInstance.methods.setRegistrar(rrInstance.options.address).send(Object.assign({}, options));
        }
        let pmInstance;
        if ((_a = deployOptions.deployPaymaster) !== null && _a !== void 0 ? _a : false) {
            pmInstance = await this.deployPaymaster(Object.assign({}, options), rInstance.options.address, fInstance, deployOptions.skipConfirmation);
        }
        await (0, common_1.registerForwarderForGsn)(provider_1.defaultGsnConfig.domainSeparatorName, fInstance, console, options);
        let stakingTokenAddress = deployOptions.stakingTokenAddress;
        let ttInstance;
        if ((_b = deployOptions.deployTestToken) !== null && _b !== void 0 ? _b : false) {
            ttInstance = await this.getContractInstance(TestWrappedNativeToken_json_1.default, {}, undefined, Object.assign({}, options), deployOptions.skipConfirmation);
            console.log('Setting minimum stake of 1 TestWeth on Hub');
            await rInstance.methods.setMinimumStakes([ttInstance.options.address], [1e18.toString()]).send(Object.assign({}, options));
            stakingTokenAddress = ttInstance.options.address;
        }
        const stakingTokenContract = await this.contractInteractor._createERC20(stakingTokenAddress !== null && stakingTokenAddress !== void 0 ? stakingTokenAddress : '');
        const tokenDecimals = await stakingTokenContract.decimals();
        const tokenSymbol = await stakingTokenContract.symbol();
        const formatToken = (val) => (0, common_1.formatTokenAmount)((0, web3_utils_1.toBN)(val.toString()), tokenDecimals, stakingTokenAddress !== null && stakingTokenAddress !== void 0 ? stakingTokenAddress : '', tokenSymbol);
        console.log(`Setting minimum stake of ${formatToken(deployOptions.minimumTokenStake)}`);
        await rInstance.methods.setMinimumStakes([stakingTokenAddress], [deployOptions.minimumTokenStake]).send(Object.assign({}, options));
        this.deployment = {
            relayHubAddress: rInstance.options.address,
            stakeManagerAddress: sInstance.options.address,
            penalizerAddress: pInstance.options.address,
            relayRegistrarAddress: rrInstance.options.address,
            forwarderAddress: fInstance.options.address,
            managerStakeTokenAddress: stakingTokenAddress,
            paymasterAddress: (_c = pmInstance === null || pmInstance === void 0 ? void 0 : pmInstance.options.address) !== null && _c !== void 0 ? _c : common_1.constants.ZERO_ADDRESS
        };
        await this.contractInteractor.initDeployment(this.deployment);
        return this.deployment;
    }
    async getContractInstance(json, constructorArgs, address, options, skipConfirmation = false) {
        const contractName = json.contractName;
        let contractInstance;
        if (address == null) {
            const sendMethod = this
                .contract(json)
                .deploy(constructorArgs);
            const estimatedGasCost = await sendMethod.estimateGas();
            const maxCost = (0, web3_utils_1.toBN)(options.gasPrice.toString()).mul((0, web3_utils_1.toBN)(options.gas.toString()));
            console.log(`Deploying ${contractName} contract with gas limit of ${options.gas.toLocaleString()} at ${(0, web3_utils_1.fromWei)(options.gasPrice.toString(), 'gwei')}gwei (estimated gas: ${estimatedGasCost.toLocaleString()}) and maximum cost of ~ ${(0, web3_utils_1.fromWei)(maxCost)} ETH`);
            if (!skipConfirmation) {
                await this.confirm();
            }
            // @ts-ignore - web3 refuses to accept string as gas limit, and max for a number in BN is 0x4000000 (~67M)
            const deployPromise = sendMethod.send(Object.assign({}, options));
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            deployPromise.on('transactionHash', function (hash) {
                console.log(`Transaction broadcast: ${hash}`);
            });
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            deployPromise.on('error', function (err) {
                console.debug(`tx error: ${err.message}`);
            });
            contractInstance = await deployPromise;
            console.log(`Deployed ${contractName} at address ${contractInstance.options.address}\n\n`);
        }
        else {
            console.log(`Using ${contractName} at given address ${address}\n\n`);
            contractInstance = this.contract(json, address);
        }
        return contractInstance;
    }
    async deployPaymaster(options, hub, fInstance, skipConfirmation) {
        const pmInstance = await this.getContractInstance(TestPaymasterEverythingAccepted_json_1.default, {}, undefined, Object.assign({}, options), skipConfirmation);
        await pmInstance.methods.setRelayHub(hub).send(options);
        await pmInstance.methods.setTrustedForwarder(fInstance.options.address).send(options);
        return pmInstance;
    }
    async confirm() {
        let input;
        while (true) {
            console.log('Confirm (yes/no)?');
            input = await console_read_write_1.default.read();
            if (input === 'yes') {
                return;
            }
            else if (input === 'no') {
                throw new Error('User rejected');
            }
        }
    }
    async getGasPrice() {
        const gasPrice = await this.contractInteractor.getGasPrice();
        console.log(`Using network gas price of ${(0, web3_utils_1.fromWei)(gasPrice, 'gwei')}`);
        return gasPrice;
    }
}
exports.CommandsLogic = CommandsLogic;
//# sourceMappingURL=CommandsLogic.js.map