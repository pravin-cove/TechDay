/**
 * Imports for the project
 */
var noble = require('noble');
/**
 * Global variables
 */
var isTitanWeFound = false;
var titanWeMacAddress = '80eacd000c4f'
noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanning();
    } else {
      noble.stopScanning();
    }
  });
  noble.on('discover', (peripheral) => {
      console.log('device discovered');
      if(peripheral.id == titanWeMacAddress) {
        console.log('Device found; ' + peripheral);
        noble.stopScanning();
      }
  });