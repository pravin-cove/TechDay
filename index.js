/**
 * Imports for the project
 */
var noble = require('noble');
/**
 * Global variables
 */
var isTitanWeFound = false;
var titanWeMacAddress = '80eacd000c4f'
/**
 * Listen to the state change and start scanning for BLE devices
 * when the Bluetooth adapter turns ON.
 */
noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanning();
    } else {
      noble.stopScanning();
    }
  });
  /**
   * See if we have found all required device and connect to those devices
   * and stop scanning once all required devices are found.
   */
  noble.on('discover', (peripheral) => {
      console.log('device discovered');
      if(peripheral.id == titanWeMacAddress) {
        console.log('Titan We watch discovered.');
        isTitanWeFound = true;
        connectToTitanWeWatch(peripheral);
      }
      if(isTitanWeFound) {
        noble.stopScanning();
      }
  });
  /**
   * Here we try to connect to particualr device and turn ON notifications
   * for the required characterstics of the device.
   */
  function connectToTitanWeWatch(titanWeWatch) {
    titanWeWatch.connect((error) => {
        if(error) {
            throw error;
        }
        console.log('Connected to Titan We watch.');
    });
  }