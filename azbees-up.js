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
  , md5file = require('md5-file')
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
  .option('-s, --stresslevel <number-of-instances>', 'number of load threads: if not specified, the default is 100 threads', 100)
  .option('-a, --archive <archive-file-path>', 'archive containing required binaries to run load')
  .option('-w, --waittime <time-in-mseconds>', 'wait time between frames, default value is 1000',1000)
  .option('-b, --breath <time-in-mseconds>', 'breath time, default value is 100',100)
  .option('-x, --executable <executable-file-path>', 'relative path of the executable that will be used to run the load test')
  .option('-f, --filename <complete-file-name-and-path>', 'config file, by default : "azbees.config"', 'azbees.config')  
  .parse(process.argv);

_checkParams();
_checkConfig(function(config){
	_createSwarm(config);
});



function _checkParams(){
	if (!program.archive) {
		inputError('Archive file is mandatory')
	}
	if (!fs.existsSync(program.archive)) {
		inputError('Unable to locate archive file: '+program.archive)
	}
	if (!program.executable) {
		inputError('the executable relative path in the archive is manadatory');
	}
	if (isNaN(program.instances)){
		inputError('Insatnces must be an integer value');
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
		timestamp : {value: new Date().getTime()},
		stressLevel: {value: parseInt(program.stresslevel)},
		waitTime: {value:parseInt(program.waittime)},
		breath:{value:parseInt(program.breath)},
		commandToExecute : { value : 'powershell.exe -ExecutionPolicy Unrestricted -File startupscript.ps1 --executablePath C:\\bees\\'+program.executable }
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
					_uploadFile(blobService, containerName, blobExecutableName, program.archive, function(err, data){
						if (err) {
							callback(err);
						} else {
							var archiveUrl = blobService.getUrl(containerName, blobExecutableName);
						    console.log("access the blob at ", archiveUrl);
							config.fileURIs = [
						    	archiveUrl,
						    ];
							console.log('Uploading startup script...');
							_uploadFile(blobService, containerName, blobStartupsrciptName, 'scripts/'+blobStartupsrciptName, function(err, data){
								var scriptUrl = blobService.getUrl(containerName, blobStartupsrciptName);
							    console.log("access the blob at ", scriptUrl);
							    config.fileURIs.push(scriptUrl);
								callback(err);
							});
						}
					});
/*
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
*/
				} else {
					callback(error);
				}
			});
        }
    });

}

function _uploadFile(blobService, container, name, localFile, callback){
	// try to find if we alreadu uploaded the same file...
	var md5 = md5file.sync(localFile);
	console.log('file signature for ',localFile,' is: ', md5);
	blobService.getBlobProperties(container, name, function(fetchErr,fetchData){
		var found = false;
		if (fetchErr) {
			console.log('Unable to fetch file meta-data, file will be re-upoloaded');
		}
		if (fetchData) {
			//console.log(fetchData.metadata);
			if (fetchData.metadata["md5"] == md5) {
				console.log('Found file with the same signature, skipping upload');
				console.log(fetchData.metadata["md5"], ' == ', md5);
				found = true;
			} else {
				console.log('Found file with a different signature, the file will be re-uploaded')
			}
		}

		if (found) {
			callback(null);
		} else {
			blobService.createBlockBlobFromLocalFile(container, name, localFile, {metadata:{"md5":md5}},function (error){
				console.log('Upload complete.')
				callback(error);
			});
		}
	});
}

