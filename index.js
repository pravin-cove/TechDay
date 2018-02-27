/**
 * Imports for the project
 */
var noble = require('noble');
let huejay = require('huejay');
var Gpio = require('onoff').Gpio;

/**
 * Global variables
 */
// RSSI update interval
var RSSI_UPDATE_INTERVAL = 2000;
//Titan WE watch - 1
var isTitanWeFound = false;
var titanWEMacAddress = '80eacd000c4f'
var titanWEServiceUUID = '000056ef00001000800000805f9b34fb';
var titanWECharacterstic = '000034e200001000800000805f9b34fb';
//Define switch GPIO ports
var switch1 = new Gpio(17, 'out');
var switch2 = new Gpio(22, 'out');
//Define a client for Philips Hue Bridge.
var hueBridgeClient;
var scenes = ['ALSAIYkjGcoTqZT', 'zz9M5RxxqRL8Cc2', '0kWGStrvP36KHY6', 'K-AyEndxZK6Kaa3', 'WozW-BVdWQf6k9Z', '8DuWm-MRNH7HIuk', '1-c4mo69pPP0KuD', 'c-erWk-Q5i5DdnD', 'PzFrXlOGzTz8pLs', '7MJTcWq40n1IIJW', '76mpkohdYNKlfcq'];
var sceneNames = ['Read', 'Tropical twilight', 'Spring blossom', 'Savanna sunset', 'Arctic aurora', 'Energize', 'Relax', 'Dimmed', 'Bright', 'Concentrate', 'Nightlight'];
var sceneIndex = 0;
/**
 * Listen to the state change and start scanning for BLE devices
 * when the Bluetooth adapter turns ON.
 */
noble.on('stateChange', function (state) {
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
    // console.log(`Found [${peripheral.advertisement.localName}]`);
    if (peripheral.id == titanWEMacAddress) {
        console.log('Titan WE watch discovered.');
        isTitanWeFound = true;
        connectToTitanWeWatch(peripheral);
        updateToRssiUpdate(peripheral);
    }
    if (isTitanWeFound) {
        noble.stopScanning();
    }
});

function updateToRssiUpdate(peripheral) {
    if (peripheral) {
        console.log('Subscribled to Rssi');
        setInterval(() => {
            peripheral.once('rssiUpdate', (rssi) => {
                console.log(peripheral.uuid + ' RSSI updated : ' + rssi);
            });
        }, RSSI_UPDATE_INTERVAL);
    }
}

/**
 * Start searching for Philips Hue Bridge and if discovered create a client.
 */
console.log('Searching for Hue Bridges in local network...')
huejay.discover()
    .then(bridges => {
        var bridgeIp;
        for (let bridge of bridges) {
            console.log(`Bridge found -> Id: ${bridge.id}, IP: ${bridge.ip}`);
            bridgeIp = bridge.ip;
        }
        hueBridgeClient = new huejay.Client({
            host: bridgeIp,
            username: '5OnfNdyaHCAWjp6fv9LY5Fn6Hi2MoDk8o0gZHyYu',
            timeout: 15000,
        });
        hueBridgeClient.bridge.ping()
            .then(() => {
                console.log('Successful connection');
                hueBridgeClient.bridge.isAuthenticated()
                    .then(() => {
                        console.log('Successful authentication');
                    })
                    .catch(error => {
                        console.log('Could not authenticate');
                    });
            })
            .catch(error => {
                console.log('Could not connect');
            });
    })
    .catch(error => {
        console.log(`An error occurred: ${error.message}`);
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
        if (error) {
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
        if (error) {
            throw error;
            return
        }
        if (services[0]) {
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

function buttonClickedOnTitanWEWatch(data, isNotification) {
    console.log(`Button pressed ${data}`);
    switch (data.toString()) {
        case 'S1':
            var switch1State = switch1.readSync();
            switch1.writeSync(switch1State ^ 1);
            break;
        case 'S2':
            changeScene();
            // findScenes();
            break;
        case 'S3':
            console.log('S3 clicked');
            var switch2State = switch2.readSync();
            switch2.writeSync(switch2State ^ 1);
            break;
    }
}

function changeScene() {
    if (hueBridgeClient) {
        console.log(`Setting theme -> ${sceneNames[sceneIndex]}`)
        hueBridgeClient.groups.getById(1)
            .then(group => {
                group.scene = scenes[sceneIndex];
                return hueBridgeClient.groups.save(group);
            })
            .then(group => {
                sceneIndex++;
                if (sceneIndex === 11) {
                    sceneIndex = 0;
                }
            })
            .catch(error => {
                console.log(error.stack);
            });
    }
}

function findScenes() {
    if (hueBridgeClient) {
        hueBridgeClient.scenes.getAll()
            .then(scenes => {
                for (let scene of scenes) {
                    console.log(`Scene [${scene.id}]: ${scene.name}`);
                    console.log('Lights:', scene.lightIds.join(', '));
                    console.log();
                }
            });
    }
}