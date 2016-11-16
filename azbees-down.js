#!/usr/bin/env node
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict'; 

var program = require('commander')
  , async = require('async')
  , inputError = require('./common.js').inputError
  , printErrorAndExit = require('./common.js').printErrorAndExit
  , printSuccess = require('./common.js').printSuccess
  , serviceError = require('./common.js').serviceError
  , util = require('util')
  , fs = require('fs')
  , path = require('path')
  , msRestAzure = require('ms-rest-azure')
  , ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient
  ;

var maxInstances = 5
  , location = 'eastus'
  , resourceGroupName = 'azbees_rg'
  , deploymentName = 'azbees_deployment'
  , resourceClient
  ;


program
  .description('delete all the injectors')
  .option('-f, --filename <complete-file-name-and-path>', 'config file, by default : "azbees.config"', 'azbees.config')  
  .parse(process.argv);

_checkParams();
_checkConfig(function(config){
	_deleteSwarm(config);
});



function _checkParams(){
}

function _checkConfig(cb){
	fs.readFile(program.filename, function(err, data){
		if (err) {
			printErrorAndExit(util.format('Impossible to open config file: %s',program.filename))
		} else {
			try {
				var config=JSON.parse(data);
				var envs = [];
				if (!config.clientId) envs.push('ClientId');
				if (!config.clientSecret) envs.push('ClientSecret');
				if (!config.tenant) envs.push('Tenant');
				if (!config.subscriptionId) envs.push('SubscriptionId');
				if (envs.length > 0) {
					inputError(util.format('config is mising the following values: %s. Please use azbees config.', envs.toString()));
				}

			} catch (e) {
				printErrorAndExit('Malformed config file. Please use azbees config to generate one');
			}
			return cb(JSON.parse(data))
		}
	});
}

function _deleteSwarm(config){
	msRestAzure.loginWithServicePrincipalSecret(config.clientId, config.clientSecret, config.tenant, function (err, credentials) {
		if (err) {
			serviceError(err);
		}

		resourceClient = new ResourceManagementClient(credentials, config.subscriptionId);

		_deleteDeployment(function (err, result) {
			if (err) { 
				serviceError(err);
				//return console.log('Error occured in deleting the deployment: ' + deploymentName + '\n' + util.inspect(err, { depth: null }));
			}

			printSuccess('Successfully deleted deployment');
			//console.log('Successfully deleted the deployment: ' + deploymentName);
			console.log('\nDeleting the resource group can take few minutes, so please be patient :).');
			_deleteResourceGroup(function (err, result) {
				if (err) {
					serviceError(err);
				}
				printSuccess('Successfully deleted the resourcegroup: ' + resourceGroupName);
			});
		});
	});
}

function _deleteDeployment(callback) {
  console.log(util.format('\nDeleting deployment:  %s'), deploymentName);
  return resourceClient.deployments.deleteMethod(resourceGroupName, deploymentName, callback);
}

function _deleteResourceGroup(callback) {
  console.log('\nDeleting resource group: ' + resourceGroupName);
  return resourceClient.resourceGroups.deleteMethod(resourceGroupName, callback);
}
