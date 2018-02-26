/**
 * Imports for the project
 */
var noble = require('noble');
var huejay = require('huejay');
var Gpio = require('onoff').Gpio;

/**
 * Global variables
 */
//Titan WE watch - 1
var isTitanWeFound = false;
var titanWEMacAddress = '80eacd000c4f'
var titanWEServiceUUID = '000056ef00001000800000805f9b34fb';
var titanWECharacterstic = '000034e200001000800000805f9b34fb';
//Define switch GPIO ports
var switch1 = new Gpio(17, 'out');
var switch2 = new Gpio(22, 'out');
/**
 * Listen to the state change and start scanning for BLE devices
 * when the Bluetooth adapter turns ON.
 */
noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        console.log('Scanning for devices...');
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
      if(peripheral.id == titanWEMacAddress) {
        console.log('Titan WE watch discovered.');
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
      titanWeWatch.on('disconnect', () => {
          console.log('Titan WE watch disconnected.');
          console.log('Scanning for devices...');
          noble.startScanning();
      });
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
      console.log('Scanning for services...')
    titanWeWatch.discoverServices([titanWEServiceUUID], (error, services) => {
        if(error) {
            throw error;
            return
        }
        if(services[0]){
            console.log('Services found for Titan WE watch.');
            console.log('Scanning for characteristics...');
            services[0].discoverCharacteristics(titanWECharacterstic, (error, characteristics) => {
                console.log('Characteristics found for Titan WE watch.');
                console.log('Titan WE watch connected and ready to be used.');
                characteristics[0].on('data', (data, isNotification) => buttonClickedOnTitanWEWatch(data, isNotification));
            });
        }
    });
  }

  function buttonClickedOnTitanWEWatch(data, isNotification){
      switch(data){
          case 0x5331:
            var switch1State = switch1.readSync();
            switch1.writeSync(switch1State^1);
            break;
          case 0x5332:
            var switch2State = switch2.readSync();
            switch2.writeSync(switch1State^1);
            break;
          case 0x5333:
            console.log('S3 clicked');
            break;  
      }
  }