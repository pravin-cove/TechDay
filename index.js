/**
 * Imports for the project
 */
var noble = require('noble');
/**
 * Global variables
 */
var isTitanWeFound = false;
var titanWeMacAddress = ''
noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanning();
    } else {
      noble.stopScanning();
    }
  });
  noble.on('discover', (peripheral) => {
      console.log('device discovered');
      console.log('Device found; ' + peripheral);
  });