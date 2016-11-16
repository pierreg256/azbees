// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

// node native modules
var fs = require('fs');

// external dependencies
var colorsTmpl = require('colors-tmpl');
 

function inputError(message) {
  printErrorAndExit(message, 'Input Error:'); 
}

function printErrorAndExit(message, prefix) {
  if (!prefix) {
    prefix = 'Error:';
  }

  console.error(colorsTmpl('\n{bold}{red}' + prefix + '{/red}{/bold} ' + message));
  process.exit(1);
}

function serviceError(err) {
  var message = err.toString();
  if (message.lastIndexOf('Error:', 0) === 0) {
    message = message.slice('Error:'.length);
  }
  printErrorAndExit(message);
}

function printSuccess(message) {
  console.log(colorsTmpl('{green}' + message + '{/green}'));
}

module.exports = {
  inputError: inputError,
  serviceError: serviceError,
  printSuccess: printSuccess,
  printErrorAndExit: printErrorAndExit
};