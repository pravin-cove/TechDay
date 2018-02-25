/**
 * Imports for the project
 */
var noble = require('noble');

/**
 * Global variables
 */
var isTitanWeFound = false;
var titanWEMacAddress = '80eacd000c4f'
var titanWEServiceUUID = '000056ef00001000800000805f9b34fb';
var titanWECharacterstic = '000034e200001000800000805f9b34fb';

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
      if(peripheral.id == titanWEMacAddress) {
        console.log('Titan We watch discovered.');
        isTitanWeFound = true;
        connectToTitanWeWatch(peripheral);
      }
      if(isTitanWeFound) {
        noble.stopScanning();
      }
  });

  /**
   * Here we try to connect to particualr device and discover
   * its services.
   */
  function connectToTitanWeWatch(titanWeWatch) {
    titanWeWatch.connect((error) => {
        if(error) {
            throw error;
            return
        }
        console.log('Connected to Titan We watch.');
        discoverTitanWEServices(titanWeWatch);
    });
  }
  /**
   * See if we can discover required service & chacterstic, and ssubscribe to it.
   * @param {peripheral} titanWeWatch 
   */
  function discoverTitanWEServices(titanWeWatch) {
    titanWeWatch.discoverServices([titanWEServiceUUID], (error, services) => {
        if(error) {
            throw error;
            return
        }
        if(services[0]){
            console.log('Service discovered in Titan WE watch.');
            services[0].discoverCharacteristics(titanWECharacterstic, (error, characteristics) => {
                console.log('Characteristics found in Titan WE watch.');
                characteristics[0].on('data', (data, isNotification) => buttonClickedOnTitanWEWatch(data, isNotification));
            });
        }
    });
  }

  function buttonClickedOnTitanWEWatch(data, isNotification){
      console.log(`Button pressed. Data: [${data}], isNotification: [${isNotification}]`)
  }