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
exports.CommandLineStatisticsPresenter = void 0;
// @ts-ignore
const ethval_1 = __importDefault(require("ethval"));
const cli_table_1 = __importDefault(require("cli-table"));
const colors_1 = __importDefault(require("colors"));
const moment_1 = __importDefault(require("moment"));
const terminal_link_1 = __importDefault(require("terminal-link"));
const asciichart = __importStar(require("asciichart"));
const GSNStatistics_1 = require("@opengsn/common/dist/types/GSNStatistics");
class CommandLineStatisticsPresenter {
    constructor(config) {
        this.config = config;
    }
    getStatisticsStringPresentation(statistics) {
        let message = `GSN status for version ${statistics.runtimeVersion} on ChainID ${statistics.chainId} at block height ${statistics.blockNumber}\n\n`;
        message += this.createContractsDeploymentTable(statistics.contractsDeployment, statistics.deploymentBalances, statistics.deploymentVersions);
        message += '\n\nRelay Hub constructor parameters:\n';
        message += this.printRelayHubConstructorParams(statistics.relayHubConstructorParams);
        message += '\n\nTransactions:\n';
        message += this.printTransactionsPlot(statistics.blockNumber, statistics.relayHubEvents);
        message += '\n\nActive Relays:\n';
        message += this.printActiveServersInfo(statistics.blockNumber, statistics.relayServers);
        message += '\n\nNon-active Relays:\n';
        message += this.printNonActiveServersInfo(statistics.blockNumber, statistics.relayServers);
        message += '\n\nPaymasters:\n';
        message += this.printPaymastersInfo(statistics.blockNumber, statistics.paymasters);
        return message;
    }
    createContractsDeploymentTable(deployment, balances, versions) {
        var _a, _b, _c, _d, _e, _f;
        const table = new cli_table_1.default({ head: ['', 'Address', 'Balance', 'Version'] });
        table.push({ 'Stake Manager': [this.toBlockExplorerLink(deployment.stakeManagerAddress, true), this.ethValueStr(balances[(_a = deployment.stakeManagerAddress) !== null && _a !== void 0 ? _a : '']), versions[(_b = deployment.stakeManagerAddress) !== null && _b !== void 0 ? _b : '']] });
        table.push({ 'Penalizer ': [this.toBlockExplorerLink(deployment.penalizerAddress, true), this.ethValueStr(balances[(_c = deployment.penalizerAddress) !== null && _c !== void 0 ? _c : '']), versions[(_d = deployment.penalizerAddress) !== null && _d !== void 0 ? _d : '']] });
        table.push({ 'Relay Hub': [this.toBlockExplorerLink(deployment.relayHubAddress, true), this.ethValueStr(balances[(_e = deployment.relayHubAddress) !== null && _e !== void 0 ? _e : '']), versions[(_f = deployment.relayHubAddress) !== null && _f !== void 0 ? _f : '']] });
        return table.toString();
    }
    toBlockExplorerLink(value = '', isAddress = true) {
        let truncatedAddress = value.slice(0, this.config.urlTruncateToLength + 2);
        if (this.config.urlTruncateToLength < value.length) {
            truncatedAddress += '…';
        }
        if (this.config.blockExplorerUrl == null) {
            return truncatedAddress;
        }
        const type = isAddress ? 'address/' : 'tx/';
        const url = this.config.blockExplorerUrl + type + value;
        if (!terminal_link_1.default.isSupported) {
            return url;
        }
        return (0, terminal_link_1.default)(truncatedAddress, url);
    }
    /**
     * Converts amount in wei to a human-readable string
     * @param value - amount in wei
     * @param units - units to convert to; only full 1e18 unit ('eth') will be replaced with ticker symbol
     */
    ethValueStr(value = '0', units = 'eth') {
        const valueStr = new ethval_1.default(value).to(units).toFixed(this.config.valuesTruncateToLength);
        const unitString = units === 'eth' ? this.config.nativeTokenTickerSymbol : units;
        return `${valueStr} ${unitString}`;
    }
    printTransactionsPlot(currentBlock, relayHubEvents) {
        return this.createRecentTransactionsChart(currentBlock, relayHubEvents.transactionRelayedEvents, relayHubEvents.transactionRejectedEvents);
    }
    printActiveServersInfo(currentBlock, relayServerInfos) {
        var _a, _b;
        const activeRelays = relayServerInfos.filter(it => it.isRegistered);
        if (activeRelays.length === 0) {
            return 'no active relays found';
        }
        const table = new cli_table_1.default({ head: ['Host', 'Ping status', 'Addresses & balances', 'Fee', 'Authorized Hubs', 'Transactions', 'Registration renewals'] });
        for (const relayServerInfo of activeRelays) {
            if (relayServerInfo.registrationInfo == null) {
                throw new Error('registrationInfo not initialized for a registered relay');
            }
            const host = new URL(relayServerInfo.registrationInfo.lastRegisteredUrl).host;
            // TODO: process errors into human-readable status
            const pingStatus = relayServerInfo.registrationInfo.pingResult.pingResponse != null
                ? relayServerInfo.registrationInfo.pingResult.pingResponse.ready.toString().substr(0, 20)
                : (_b = (_a = relayServerInfo.registrationInfo.pingResult.error) === null || _a === void 0 ? void 0 : _a.toString().substr(0, 20)) !== null && _b !== void 0 ? _b : 'unknown';
            const addressesAndBalances = this.createAddressesAndBalancesSubTable(relayServerInfo);
            const authorizedHubs = this.createAuthorizedHubsSubTable(relayServerInfo);
            const recentChart = this.createRecentTransactionsChart(currentBlock, relayServerInfo.relayHubEvents.transactionRelayedEvents, relayServerInfo.relayHubEvents.transactionRejectedEvents);
            const registrationRenewals = this.createRegistrationRenewalsSubTable(currentBlock, relayServerInfo.relayHubEvents.relayRegisteredEvents);
            table.push([host, pingStatus, addressesAndBalances, authorizedHubs, recentChart, registrationRenewals]);
        }
        return table.toString();
    }
    printNonActiveServersInfo(currentBlock, relayServerInfos) {
        const nonActiveRelays = relayServerInfos.filter(it => !it.isRegistered);
        if (nonActiveRelays.length === 0) {
            return 'no non-active relays found';
        }
        const table = new cli_table_1.default({ head: ['Manager address', 'Status', 'First Seen', 'Last Seen', 'Total Relayed'] });
        for (const relay of nonActiveRelays) {
            const status = this.stringServerStatus(relay.stakeStatus);
            const managerAddressLink = this.toBlockExplorerLink(relay.managerAddress, true);
            const firstSeen = 'TODO';
            const lastSeen = 'TODO';
            const totalTx = relay.relayHubEvents.transactionRelayedEvents.length;
            table.push([managerAddressLink, status, firstSeen, lastSeen, totalTx]);
        }
        return table.toString();
    }
    createAddressesAndBalancesSubTable(relayServerInfo) {
        var _a, _b, _c;
        const table = new cli_table_1.default({ head: ['Role', 'Address', 'Balance'] });
        table.push(['OWN', this.toBlockExplorerLink(relayServerInfo.stakeInfo.owner, true), this.ethValueStr(relayServerInfo.ownerBalance)]);
        table.push(['MGR', this.toBlockExplorerLink(relayServerInfo.managerAddress, true), this.ethValueStr(relayServerInfo.managerBalance)]);
        for (const workerAddress of (_b = (_a = relayServerInfo.registrationInfo) === null || _a === void 0 ? void 0 : _a.registeredWorkers) !== null && _b !== void 0 ? _b : []) {
            const workerBalance = this.ethValueStr((_c = relayServerInfo.registrationInfo) === null || _c === void 0 ? void 0 : _c.workerBalances[workerAddress]);
            table.push(['W#1', this.toBlockExplorerLink(workerAddress, true), workerBalance]);
        }
        const table2 = new cli_table_1.default();
        const relayHubEarningsBalance = this.ethValueStr(relayServerInfo.relayHubEarningsBalance);
        const totalDepositedStake = this.ethValueStr(relayServerInfo.stakeInfo.stake.toString());
        table2.push(['RelayHub earnings ', relayHubEarningsBalance]);
        table2.push(['Deposited Stake', totalDepositedStake]);
        return table.toString() + '\n' + table2.toString();
    }
    createAuthorizedHubsSubTable(relayServerInfo) {
        const table = new cli_table_1.default({ head: ['Address', 'Version'] });
        for (const hub of Object.keys(relayServerInfo.authorizedHubs)) {
            table.push([this.toBlockExplorerLink(hub, true), relayServerInfo.authorizedHubs[hub]]);
        }
        return table.toString();
    }
    createRecentTransactionsChart(currentBlock, transactionRelayedEvents, transactionRejectedEvents) {
        if (transactionRelayedEvents.length === 0 && transactionRejectedEvents.length === 0) {
            return 'no transactions';
        }
        const config = {
            colors: [
                asciichart.green,
                asciichart.red
            ],
            format: function (x) {
                return `${x.toString().padStart(3, '0')} `;
            }
        };
        // this code is ugly af but does work with negative 'beginning block'
        const weekBeginningBlockApprox = currentBlock - this.config.averageBlocksPerDay * this.config.daysToPlotTransactions;
        const relayedByDay = this.getEventsByDayCount(transactionRelayedEvents, weekBeginningBlockApprox);
        const rejectedByDay = this.getEventsByDayCount(transactionRejectedEvents, weekBeginningBlockApprox);
        // @ts-ignore
        let plot = asciichart.plot([relayedByDay, rejectedByDay], config);
        plot += `\n${colors_1.default.green('accepted')} ${colors_1.default.red('rejected')}`;
        return plot;
    }
    getEventsByDayCount(transactionRelayedEvents, weekBeginningBlockApprox) {
        const eventsByDay = new Array(this.config.daysToPlotTransactions).fill(0);
        for (const event of transactionRelayedEvents) {
            if (event.eventData.blockNumber <= weekBeginningBlockApprox) {
                continue;
            }
            // If the event is in the CURRENT block, it will 'floor' to 7 while last index is 6
            const index = Math.floor((event.eventData.blockNumber - weekBeginningBlockApprox - 1) / this.config.averageBlocksPerDay);
            eventsByDay[index]++;
        }
        return eventsByDay;
    }
    stringServerStatus(status) {
        switch (status) {
            case GSNStatistics_1.RelayServerStakeStatus.STAKE_LOCKED:
                return 'stake locked';
            case GSNStatistics_1.RelayServerStakeStatus.STAKE_WITHDRAWN:
                return 'withdrawn';
            case GSNStatistics_1.RelayServerStakeStatus.STAKE_UNLOCKED:
                return 'unlocked';
            case GSNStatistics_1.RelayServerStakeStatus.STAKE_PENALIZED:
                return 'penalized';
        }
    }
    createRegistrationRenewalsSubTable(currentBlock, relayRegisteredEvents) {
        const table = new cli_table_1.default({ head: ['Link', 'Block number', 'Time estimate'] });
        for (const event of relayRegisteredEvents) {
            const eventBlock = event.eventData.blockNumber;
            const estimateDays = (currentBlock - eventBlock) / this.config.averageBlocksPerDay;
            const blockMoment = (0, moment_1.default)().subtract(estimateDays, 'days');
            const link = this.toBlockExplorerLink(event.eventData.transactionHash, false);
            table.push([link, eventBlock, blockMoment.fromNow()]);
        }
        return table.toString();
    }
    printPaymastersInfo(blockNumber, paymasters) {
        if (paymasters.length === 0) {
            return 'no paymasters found';
        }
        const table = new cli_table_1.default({ head: ['Address', 'Hub balance', 'Transactions accepted', 'Transaction rejected'] });
        const paymastersSortedSliced = paymasters.sort((a, b) => b.acceptedTransactionsCount - a.acceptedTransactionsCount)
            .slice(0, 10);
        for (const paymaster of paymastersSortedSliced) {
            const address = this.toBlockExplorerLink(paymaster.address, true);
            const balance = this.ethValueStr(paymaster.relayHubBalance);
            table.push([address, balance, paymaster.acceptedTransactionsCount, paymaster.rejectedTransactionsCount]);
        }
        let string = table.toString();
        if (paymasters.length > 10) {
            string += `\n and ${paymasters.length - 10} more...`;
        }
        return string;
    }
    printRelayHubConstructorParams(params) {
        const table = new cli_table_1.default();
        table.push(['Max worker count', params.maxWorkerCount], ['Minimum unstake delay', `${params.minimumUnstakeDelay} blocks`], ['Gas Reserve', params.gasReserve], ['Post Overhead', params.postOverhead], ['Gas Overhead', params.gasOverhead]);
        return table.toString();
    }
}
exports.CommandLineStatisticsPresenter = CommandLineStatisticsPresenter;
//# sourceMappingURL=CommandLineStatisticsPresenter.js.map