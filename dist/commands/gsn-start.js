"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const utils_1 = require("../utils");
const GsnTestEnvironment_1 = require("../GsnTestEnvironment");
(0, utils_1.gsnCommander)(["n"])
    .option("-w, --workdir <directory>", "relative work directory (defaults to build/gsn/)", "build/gsn")
    .parse(process.argv);
(async () => {
    try {
        const network = commander_1.default.network;
        const port = 8090;
        const env = await GsnTestEnvironment_1.GsnTestEnvironment.startGsn(network, port);
        (0, utils_1.saveDeployment)(env.contractsDeployment, commander_1.default.workdir);
        (0, utils_1.showDeployment)(env.contractsDeployment, "GSN started");
        console.log(`Relay is active, URL = ${env.relayUrl} . Press Ctrl-C to abort`);
    }
    catch (e) {
        console.error(e);
    }
})().catch((reason) => {
    console.error(reason);
    process.exit(1);
});
//# sourceMappingURL=gsn-start.js.map