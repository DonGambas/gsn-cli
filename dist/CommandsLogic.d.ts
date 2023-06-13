import BN from 'bn.js';
import { Contract } from 'web3-eth-contract';
import { Address, GSNContractsDeployment, IntString, LoggerInterface, PenalizerConfiguration, RelayHubConfiguration } from '@opengsn/common';
import { KeyManager } from '@opengsn/relay/dist/KeyManager';
import { ServerConfigParams } from '@opengsn/relay/dist/ServerConfigParams';
export interface RegisterOptions {
    /** ms to sleep if waiting for RelayServer to set its owner */
    sleepMs: number;
    /** number of times to sleep before timeout */
    sleepCount: number;
    from: Address;
    token?: Address;
    gasPrice?: string | BN;
    stake: string;
    wrap: boolean;
    funds: string | BN;
    relayUrl: string;
    unstakeDelay: string;
}
export interface WithdrawOptions {
    withdrawAmount: BN;
    keyManager: KeyManager;
    config: ServerConfigParams;
    broadcast: boolean;
    gasPrice?: BN;
    withdrawTarget?: string;
    useAccountBalance: boolean;
}
interface DeployOptions {
    from: Address;
    gasPrice: string;
    gasLimit: number | IntString;
    deployPaymaster?: boolean;
    forwarderAddress?: string;
    relayHubAddress?: string;
    relayRegistryAddress?: string;
    stakeManagerAddress?: string;
    deployTestToken?: boolean;
    stakingTokenAddress?: string;
    minimumTokenStake: number | IntString;
    penalizerAddress?: string;
    burnAddress?: string;
    devAddress?: string;
    verbose?: boolean;
    skipConfirmation?: boolean;
    relayHubConfiguration: RelayHubConfiguration;
    penalizerConfiguration: PenalizerConfiguration;
}
interface RegistrationResult {
    success: boolean;
    transactions?: string[];
    error?: string;
}
declare type WithdrawalResult = RegistrationResult;
export interface SendOptions {
    from: string;
    gasPrice: number | string | BN;
    gas: number | string | BN;
    value: number | string | BN;
}
export declare class CommandsLogic {
    private readonly contractInteractor;
    private readonly httpClient;
    private readonly web3;
    private deployment?;
    constructor(host: string, logger: LoggerInterface, deployment: GSNContractsDeployment, mnemonic?: string, derivationPath?: string, derivationIndex?: string, privateKey?: string);
    init(): Promise<this>;
    findWealthyAccount(requiredBalance?: BN): Promise<string>;
    isRelayReady(relayUrl: string): Promise<boolean>;
    waitForRelay(relayUrl: string, timeout?: number): Promise<void>;
    getPaymasterBalance(paymaster: Address): Promise<BN>;
    /**
     * Send enough ether from the {@param from} to the RelayHub to make {@param paymaster}'s gas deposit exactly {@param amount}.
     * Does nothing if current paymaster balance exceeds amount.
     * @param from
     * @param paymaster
     * @param amount
     * @return deposit of the paymaster after
     */
    fundPaymaster(from: Address, paymaster: Address, amount: string | BN): Promise<BN>;
    registerRelay(options: RegisterOptions): Promise<RegistrationResult>;
    _findFirstToken(relayHubAddress: string): Promise<string>;
    displayManagerBalances(config: ServerConfigParams, keyManager: KeyManager): Promise<void>;
    withdrawToOwner(options: WithdrawOptions): Promise<WithdrawalResult>;
    contract(file: any, address?: string): Contract;
    deployGsnContracts(deployOptions: DeployOptions): Promise<GSNContractsDeployment>;
    private getContractInstance;
    deployPaymaster(options: Required<SendOptions>, hub: Address, fInstance: Contract, skipConfirmation: boolean | undefined): Promise<Contract>;
    confirm(): Promise<void>;
    getGasPrice(): Promise<string>;
}
export {};
