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
  , AzureStorage = require('azure-storage')
  ;

var maxInstances = 5
  , location = 'westeurope'
  , resourceGroupName = 'azbees_rg'
  , deploymentName = 'azbees_deployment'
  , resourceClient
  , containerName = 'resources'
  , blobExecutableName = 'loaderarchive.zip'
  , blobStartupsrciptName = 'startupscript.ps1'
  ;


program
  .description('Spin Up injectors in the Azure Cloud')
  .option('-i, --instances <number-of-instances>', 'number of machines to up: if not specified, the default is one instance', 1)
  .option('-x, --executable <executable-file-path>', 'executable that will be used to run the load test')
  .option('-f, --filename <complete-file-name-and-path>', 'config file, by default : "azbees.config"', 'azbees.config')  
  .parse(process.argv);

_checkParams();
_checkConfig(function(config){
	_createSwarm(config);
});



function _checkParams(){
	if (!program.executable) {
		inputError('Executable path is mandatory')
	}
	if (!fs.existsSync(program.executable)) {
		inputError('Unable to locate executable file: '+program.executable)
	}
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
				_createStorageGroupAndContainer(config, function (err, result, request, response) {
					if (err) {
						return callback(err);
					}
					callback(null, result);
				});
			},
			function (callback) {
				//Task 1
				//console.log(config);
				_loadTemplateAndDeploy(config, function (err, result, request, response) {
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

function _loadTemplateAndDeploy(config, callback) {
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
		OS : { value : "Windows"},
		fileList : {value : config.fileURIs.join(' ')},
		timestamp : {value: new Date().getTime()}
	}

	//console.log(parameters);

	var deploymentParameters = {
		"properties": {
			"parameters": parameters,
			"template": template,
			"mode": "Incremental"
		}
	};

	console.log(util.format('Spinning '+parseInt(program.instances)+' bees in the swarm... please be patient...'));
	//console.log(util.format('\nDeploying template %s : \n%s', deploymentName, util.inspect(template, { depth: null })));
	return resourceClient.deployments.createOrUpdate(resourceGroupName, 
                                                             deploymentName, 
                                                             deploymentParameters, 
                                                             callback);

}

function _createStorageGroupAndContainer(config, callback) {
	try {
		var templateFilePath = path.join(__dirname, "templates/Storage_template.json");
		var template = JSON.parse(fs.readFileSync(templateFilePath, 'utf8'));
	} catch (ex) {
		return callback(ex);
	}

	var parameters = {};

	var deploymentParameters = {
		"properties": {
			"parameters": parameters,
			"template": template,
			"mode": "Incremental"
		}
	};

	console.log(util.format('Creating resources storage group... please be patient...'));
	return resourceClient.deployments.createOrUpdate(resourceGroupName, 
                                                             deploymentName+'Storage', 
                                                             deploymentParameters, 
                                                             function(err, data){
        if (err) {
        	callback(err)
        } else {
	        //console.log(util.inspect(data.properties.outputs, {depth:null}));
	        config.storageAccount = {
	        	name:data.properties.outputs.storageAccountName.value,
	        	key:data.properties.outputs.storageAccountKey.value
	        }
	        var blobService = AzureStorage.createBlobService(data.properties.outputs.storageAccount.value);
			blobService.createContainerIfNotExists(containerName, {
				publicAccessLevel: 'blob'
			}, function(error, result, response) {
				if (!error) {
					// if result = true, container was created.
					// if result = false, container already existed.
					// upload executable as blob
					console.log('Uploading executable file...');
					blobService.createBlockBlobFromLocalFile(containerName, blobExecutableName, program.executable, function (error) {
						if (error != null) {
							callback(error);
						} else {

						    //var sharedAccessPolicy = {
						    //    AccessPolicy: {
						    //        Expiry: AzureStorage.date.minutesFromNow(3600*24)
						    //    }
						    //};   
						    
							//var sasToken = blobService.generateSharedAccessSignature(containerName, blobExecutableName, sharedAccessPolicy);
							var archiveUrl = blobService.getUrl(containerName, blobExecutableName);
						    //var blobUrl = blobService.getBlobUrl(containerName, blobExecutableName, sharedAccessPolicy);
						    console.log("access the blob at ", archiveUrl);
						    config.fileURIs = [
						    	archiveUrl,
						    ]

						    console.log('Uploading startup script...')
							blobService.createBlockBlobFromLocalFile(containerName, blobStartupsrciptName, 'scripts/'+blobStartupsrciptName, function (error) {
								if (error != null) {
									callback(error);
								} else {

								    //var sharedAccessPolicy = {
								    //    AccessPolicy: {
								    //        Expiry: AzureStorage.date.minutesFromNow(3600*24)
								    //    }
								    //};   
								    
									//var sasToken = blobService.generateSharedAccessSignature(containerName, blobExecutableName, sharedAccessPolicy);
									var scriptUrl = blobService.getUrl(containerName, blobStartupsrciptName);
								    //var blobUrl = blobService.getBlobUrl(containerName, blobExecutableName, sharedAccessPolicy);
								    console.log("access the blob at ", scriptUrl);
								    config.fileURIs.push(scriptUrl);
									callback(null, response);
								}
							});
//
						}
					});

				} else {
					callback(error);
				}
			});
        }
    });

}

