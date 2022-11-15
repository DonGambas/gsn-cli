#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const common_1 = require("@opengsn/common");
commander_1.default
    .version(common_1.gsnRuntimeVersion)
    .command('start', 'all-on-one: deploy all contracts, start relay')
    .command('deploy', 'deploy RelayHub and other GSN contracts instances')
    .command('relayer-register', 'stake for a relayer and fund it')
    .command('relayer-withdraw', 'Withdraw relayer\'s manager balance from RelayHub to owner')
    .command('relayer-run', 'launch a relayer server')
    .command('paymaster-fund', 'fund a paymaster contract so it can pay for relayed calls')
    .command('paymaster-balance', 'query a paymaster GSN balance')
    .command('send-request', 'send a GSN meta-transaction request to a server using a GSN provider')
    .command('status', 'status of the GSN network')
    .parse(process.argv);
//# sourceMappingURL=gsn.js.map