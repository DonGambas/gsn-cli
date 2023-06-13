/// <reference types="node" />
import { Address, GSNContractsDeployment } from "@opengsn/common";
import { HttpServer } from "@opengsn/relay/dist/HttpServer";
import { RelayProvider } from "@opengsn/provider/dist/RelayProvider";
import { ChildProcess } from "child_process";
export interface TestEnvironment {
    contractsDeployment: GSNContractsDeployment;
    relayProvider: RelayProvider;
    httpServer: HttpServer;
    relayUrl: string;
    hardhatNode?: ChildProcess;
}
declare class GsnTestEnvironmentClass {
    private httpServer?;
    /**
     *
     * @param host:
     * @return
     */
    deployGsn(host: string): Promise<GSNContractsDeployment>;
    /**
     *
     * @param host:
     * @return
     */
    startGsn(host: string, port: number): Promise<TestEnvironment>;
    /**
     * initialize a local relay
     * @private
     */
    private _resolveAvailablePort;
    stopGsn(): Promise<void>;
    _runServer(host: string, deploymentResult: GSNContractsDeployment, from: Address, relayUrl: string, port: number): Promise<void>;
    /**
     * return deployment saved by "gsn start"
     * @param workdir
     * @param url - an Ethereum RPC API Node URL
     */
    loadDeployment(url: string, workdir?: string): Promise<GSNContractsDeployment>;
}
export declare const GsnTestEnvironment: GsnTestEnvironmentClass;
export {};
