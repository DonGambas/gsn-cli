"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bip39 = __importStar(require("ethereum-cryptography/bip39"));
const commander_1 = __importDefault(require("commander"));
const fs_1 = __importDefault(require("fs"));
const web3_1 = __importDefault(require("web3"));
const ethereumjs_wallet_1 = require("ethereumjs-wallet");
const web3_utils_1 = require("web3-utils");
const provider_1 = require("@opengsn/provider");
const utils_1 = require("../utils");
const CommandsLogic_1 = require("../CommandsLogic");
const CommandsWinstonLogger_1 = require("@opengsn/logger/dist/CommandsWinstonLogger");
function commaSeparatedList(value, _dummyPrevious) {
    return value.split(',');
}
(0, utils_1.gsnCommander)(['n', 'f', 'm', 'g', 'l'])
    .option('--directCall', 'whether to run transaction with relay or directly', false)
    .option('--abiFile <string>', 'path to an ABI truffle artifact JSON file')
    .option('--method <string>', 'method name to execute')
    .option('--methodParams <items>', 'comma separated args list', commaSeparatedList)
    .option('--calldata <string>', 'exact calldata to use')
    .option('--to <string>', 'target RelayRecipient contract')
    .option('--paymaster <string>', 'the Paymaster contract to be used')
    .parse(process.argv);
async function getProvider(to, paymaster, mnemonic, logger, host) {
    const config = {
        clientId: '0',
        paymasterAddress: paymaster
    };
    const provider = new web3_1.default.providers.HttpProvider(host, {
        keepAlive: true,
        timeout: 120000
    });
    let from;
    let privateKey;
    if (commander_1.default.from != null) {
        // provider-controlled private key
        from = commander_1.default.from;
        console.log('using', from);
    }
    else if (mnemonic != null) {
        const hdwallet = ethereumjs_wallet_1.hdkey.fromMasterSeed(Buffer.from(bip39.mnemonicToSeedSync(mnemonic)));
        // add mnemonic private key to the account manager as an 'ephemeral key'
        const wallet = hdwallet.deriveChild(0).getWallet();
        from = `0x${wallet.getAddress().toString('hex')}`;
        privateKey = `0x${wallet.getPrivateKey().toString('hex')}`;
        console.log('mnemonic account:', from);
    }
    else {
        throw new Error('must specify either "--mnemonic" or pass "--from" account');
    }
    if (commander_1.default.directCall === true) {
        return { provider, from };
    }
    else {
        if (paymaster == null) {
            throw new Error('--paymaster: address not specified');
        }
        const overrideDependencies = {
            logger
        };
        const input = {
            provider,
            config,
            overrideDependencies
        };
        const relayProvider = await provider_1.RelayProvider.newProvider(input).init();
        if (privateKey != null) {
            relayProvider.addAccount(privateKey);
        }
        return {
            provider: relayProvider,
            from
        };
    }
}
(async () => {
    const network = commander_1.default.network;
    const nodeURL = (0, utils_1.getNetworkUrl)(network);
    const logger = (0, CommandsWinstonLogger_1.createCommandsLogger)(commander_1.default.loglevel);
    const mnemonic = (0, utils_1.getMnemonic)(commander_1.default.mnemonic);
    const logic = new CommandsLogic_1.CommandsLogic(nodeURL, logger, {}, mnemonic, commander_1.default.derivationPath, commander_1.default.derivationIndex, commander_1.default.privateKeyHex);
    const { provider, from } = await getProvider(commander_1.default.to, commander_1.default.paymaster, mnemonic, logger, nodeURL);
    if (commander_1.default.abiFile == null || !fs_1.default.existsSync(commander_1.default.abiFile)) {
        const file = commander_1.default.abiFile;
        throw new Error(`--abiFile: ABI file ${file} does not exist`);
    }
    const abiJson = JSON.parse(fs_1.default.readFileSync(commander_1.default.abiFile, 'utf8'));
    if (commander_1.default.to == null) {
        throw new Error('--to: target address is missing');
    }
    const web3Contract = logic.contract(abiJson, commander_1.default.to);
    // @ts-ignore
    web3Contract.setProvider(provider, undefined);
    const calldata = commander_1.default.calldata;
    const methodName = commander_1.default.method;
    if (calldata != null && methodName != null) {
        throw new Error('Cannot pass both --calldata and --method');
    }
    if (calldata == null && methodName == null) {
        throw new Error('Must pass either --calldata or --method');
    }
    const method = web3Contract.methods[methodName];
    if (method == null) {
        throw new Error(`Method (${methodName}) is not found on contract`);
    }
    const methodParams = commander_1.default.methodParams;
    const gasPrice = (0, web3_utils_1.toHex)(commander_1.default.gasPrice != null ? (0, web3_utils_1.toWei)(commander_1.default.gasPrice, 'gwei').toString() : await logic.getGasPrice());
    const gas = commander_1.default.gasLimit;
    const receipt = await method(...methodParams).send({
        from,
        gas,
        gasPrice
    });
    console.log(receipt);
    console.log(JSON.stringify(methodParams));
    console.log(web3Contract.options.address);
    process.exit(0);
})().catch(reason => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-send-request.js.map