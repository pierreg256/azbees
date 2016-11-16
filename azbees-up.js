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
  .description('Spin Up injectors in the Azure Cloud')
  .option('-i, --instances <number-of-instances>', 'number of machines to up: if not specified, the default is one instance', 1)
  .option('-f, --filename <complete-file-name-and-path>', 'config file, by default : "azbees.config"', 'azbees.config')  
  .parse(process.argv);

_checkParams();
_checkConfig(function(config){
	_createSwarm(config);
});



function _checkParams(){
	if (isNaN(program.instances)){
		inputError('Instnces must be an integer value');
	} else {
		if ((program.instances<0)||(program.instances>maxInstances)){
			inputError(util.format('Instances value must be between 0 and %j', maxInstances));
		}
	}
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

function _createSwarm(config) {
	msRestAzure.loginWithServicePrincipalSecret(config.clientId, config.clientSecret, config.tenant, function (err, credentials) {
		if (err) {
			serviceError(err);
		}

		resourceClient = new ResourceManagementClient(credentials, config.subscriptionId);

		async.series([
			function (callback) {
				//Task 1
				_createResourceGroup(function (err, result, request, response) {
					if (err) {
						return callback(err);
					}
					callback(null, result);
				});
			},
			function (callback) {
				//Task 1
				_loadTemplateAndDeploy(function (err, result, request, response) {
					if (err) {
						return callback(err);
					}
					//printSuccess(util.format('\nDeployed template %s : \n%s', deploymentName, util.inspect(result, { depth: null })));
					callback(null, result);
				});
			}
		],
		function (err, results){
			if (err) {
				serviceError(err)
			}
			printSuccess('Bees spun up successfully!');
		});
	});
}

function _createResourceGroup(callback) {
  var groupParameters = { location: location, tags: { purpose: 'azbees' } };
  console.log('\nCreating resource group: ' + resourceGroupName);
  return resourceClient.resourceGroups.createOrUpdate(resourceGroupName, groupParameters, callback);
}

function _loadTemplateAndDeploy(callback) {
	try {
		var templateFilePath = path.join(__dirname, "templates/template.json");
		var template = JSON.parse(fs.readFileSync(templateFilePath, 'utf8'));
	} catch (ex) {
		return callback(ex);
	}

	var parameters = {
		adminUsername : { value : "azbeesadministrator"},
		adminPassword : { value : "Str0ngP4$$w0rd."},
		numberOfInstances : { value : parseInt(program.instances)},
		OS : { value : "Windows"}
	}

	var deploymentParameters = {
		"properties": {
			"parameters": parameters,
			"template": template,
			"mode": "Incremental"
		}
	};

	console.log(util.format('Spinning %f bees in the swarm... please be patient...', parseInt(program.instances)));
	//console.log(util.format('\nDeploying template %s : \n%s', deploymentName, util.inspect(template, { depth: null })));
	return resourceClient.deployments.createOrUpdate(resourceGroupName, 
                                                             deploymentName, 
                                                             deploymentParameters, 
                                                             callback);

}