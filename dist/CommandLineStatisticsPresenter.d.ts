import { PrefixedHexString } from 'ethereumjs-util';
import { GSNContractsDeployment, IntString, ObjectMap, SemVerString } from '@opengsn/common';
import { CommandLineStatisticsPresenterConfig } from './CommandLineStatisticsPresenterConfig';
import { EventTransactionInfo, GSNStatistics, PaymasterInfo, RelayHubConstructorParams, RelayHubEvents, RelayServerInfo, RelayServerStakeStatus } from '@opengsn/common/dist/types/GSNStatistics';
import { RelayRegisteredEventInfo, TransactionRejectedByPaymasterEventInfo, TransactionRelayedEventInfo } from '@opengsn/common/dist/types/GSNContractsDataTypes';
export declare class CommandLineStatisticsPresenter {
    config: CommandLineStatisticsPresenterConfig;
    constructor(config: CommandLineStatisticsPresenterConfig);
    getStatisticsStringPresentation(statistics: GSNStatistics): string;
    createContractsDeploymentTable(deployment: GSNContractsDeployment, balances: ObjectMap<IntString>, versions: ObjectMap<SemVerString>): string;
    toBlockExplorerLink(value?: PrefixedHexString, isAddress?: boolean): string;
    /**
     * Converts amount in wei to a human-readable string
     * @param value - amount in wei
     * @param units - units to convert to; only full 1e18 unit ('eth') will be replaced with ticker symbol
     */
    ethValueStr(value?: IntString, units?: string): string;
    printTransactionsPlot(currentBlock: number, relayHubEvents: RelayHubEvents): string;
    printActiveServersInfo(currentBlock: number, relayServerInfos: RelayServerInfo[]): string;
    printNonActiveServersInfo(currentBlock: number, relayServerInfos: RelayServerInfo[]): string;
    createAddressesAndBalancesSubTable(relayServerInfo: RelayServerInfo): string;
    createAuthorizedHubsSubTable(relayServerInfo: RelayServerInfo): string;
    createRecentTransactionsChart(currentBlock: number, transactionRelayedEvents: Array<EventTransactionInfo<TransactionRelayedEventInfo>>, transactionRejectedEvents: Array<EventTransactionInfo<TransactionRejectedByPaymasterEventInfo>>): string;
    getEventsByDayCount(transactionRelayedEvents: Array<EventTransactionInfo<TransactionRelayedEventInfo | TransactionRejectedByPaymasterEventInfo>>, weekBeginningBlockApprox: number): number[];
    stringServerStatus(status: RelayServerStakeStatus): string;
    createRegistrationRenewalsSubTable(currentBlock: number, relayRegisteredEvents: Array<EventTransactionInfo<RelayRegisteredEventInfo>>): string;
    printPaymastersInfo(blockNumber: number, paymasters: PaymasterInfo[]): string;
    printRelayHubConstructorParams(params: RelayHubConstructorParams): string;
}
