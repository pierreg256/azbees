#!/usr/bin/env node
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var program = require('commander');
var packageJson = require('./package.json');

program 
  .version(packageJson.version)
  .usage('[options] <command> [command-options] [command-args]')
  .command('up', 'start injectors')
  .command('down', 'tear down the injectors swarm')
  .command('config', 'configure load session') 
  .parse(process.argv);
