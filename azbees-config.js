#!/usr/bin/env node
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict'; 

var program = require('commander')
  , inputError = require('./common.js').inputError
  , printSuccess = require('./common.js').printSuccess
  , util = require('util')
  , fs = require('fs')
  ;


program
  .description('Configure the azbees session')
  .option('-c, --clientid <client-id>', 'ClientId of your AD application')
  .option('-s, --clientsecret <client-secret>', 'Client Secret of your AD application')
  .option('-t, --tenant <tenant-domaine>', 'domain of your AD application')
  .option('-b, --subscription <subscription-id>', 'Subscription ID to place the bees')
  .option('-f, --filename <complete-file-name-and-path>', 'config destination, by default : "azbees.config"', 'azbees.config')
  .parse(process.argv);


_validateEnvironmentVariables();



// Create the config file:
var config = {
	clientId: program.clientid,
	clientSecret: program.clientsecret,
	tenant: program.tenant,
	subscriptionId: program.subscription
};
var prettyConfig = JSON.stringify(config, null, 2);
fs.writeFileSync('azbees.config', prettyConfig);

printSuccess(util.format('Successfully stored config in the following file: %s', program.filename))


function _validateEnvironmentVariables() {
  var envs = [];
  if (!program.clientid) envs.push('ClientId');
  if (!program.clientsecret) envs.push('ClientSecret');
  if (!program.tenant) envs.push('Tenant');
  if (!program.subscription) envs.push('SubscriptionId');
  if (envs.length > 0) {
  	inputError(util.format('please set/export the following environment variables: %s', envs.toString()));
  }
}
