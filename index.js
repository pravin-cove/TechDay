/**
 * Imports for the project
 */
var noble = require('noble');
let huejay = require('huejay');
var Gpio = require('onoff').Gpio;
var statistics = require('math-statistics');
var usonic = require('mmm-usonic');

/**
 * Global variables
 */
// Ultrasonis sensor
var prevDistance = 1000;
var ECHO_PIN = 24;
var TRIGGER_PIN = 23;
var TIMEOUT = 750;
var DELAY = 20;
var MEASUREMENT_PER_SAMPLE = 5;
var DIFFERENCE_IN_DISTANCE = 50;
// RSSI update interval
var RSSI_UPDATE_INTERVAL = 2000;
var rssiUpdates;
//Titan WE watch - 1
var isTitanWeFound = false;
var titanWEMacAddress = '80eacd000c4f'
var titanWEServiceUUID = '000056ef00001000800000805f9b34fb';
var titanWECharacterstic = '000034e200001000800000805f9b34fb';
//Titan RAGA watch
var isRagaFound = false;
var RagaMacAddress = 'd2842a5ba5b8'
var RagaServiceUUID = '000056ef00001000800000805f9b34fb';
var RagaCharacterstic = '000034e200001000800000805f9b34fb';
//TIME DELAY TO TURN LIGHTS ON
var TIME_DELAY_TO_TURN_LIGHTS_ON = 10000;
//Define switch GPIO ports
var switch1 = new Gpio(17, 'out');
var switch2 = new Gpio(22, 'out');
//Define a client for Philips Hue Bridge.
var hueBridgeClient;
var scenes = ['ALSAIYkjGcoTqZT', 'zz9M5RxxqRL8Cc2', '0kWGStrvP36KHY6', 'K-AyEndxZK6Kaa3', 'WozW-BVdWQf6k9Z', '8DuWm-MRNH7HIuk', '1-c4mo69pPP0KuD', 'c-erWk-Q5i5DdnD', 'PzFrXlOGzTz8pLs', '7MJTcWq40n1IIJW', '76mpkohdYNKlfcq'];
var sceneNames = ['Read', 'Tropical twilight', 'Spring blossom', 'Savanna sunset', 'Arctic aurora', 'Energize', 'Relax', 'Dimmed', 'Bright', 'Concentrate', 'Nightlight'];
var sceneIndex = 0;


/**
 * Initialise Ultrasonic sensor for wave detection
 */
usonic.init((error) => {
    if (error) {
        console.log(error);
    } else {
        var sensor = usonic.createSensor(ECHO_PIN, TRIGGER_PIN, TIMEOUT);
        var distances;
        (function measure() {
            if (!distances || distances.length === MEASUREMENT_PER_SAMPLE) {
                if (distances) {
                    waveDetect(distances);
                }
                distances = [];
            }
            setTimeout(function () {
                distances.push(sensor());
                measure();
            }, DELAY);
        }());
    }
});


/**
 * To detect if the hands are waved.
 */
function waveDetect(distances) {
    var distance = statistics.median(distances);

    process.stdout.clearLine();
    process.stdout.cursorTo(0);

    if (distance < 0) {
        // process.stdout.write('Error: Measurement timeout.\n');
        console.log('Error in measurement.');
    } else {
        process.stdout.write('Distance: ' + distance.toFixed(2) + ' cm');
        if (distance < DIFFERENCE_IN_DISTANCE && prevDistance > DIFFERENCE_IN_DISTANCE) {
            changeScene();
        }
        prevDistance = distance;
    }
}

/**
 * Listen to the state change and start scanning for BLE devices
 * when the Bluetooth adapter turns ON.
 */
noble.on('stateChange', function (state) {
    console.log(`State changed => ${state}`);
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
    console.log(`${peripheral.advertisement.localName} discovered.`)
    if (peripheral.id == titanWEMacAddress) {
        console.log('Titan WE watch discovered.');
        isTitanWeFound = true;
        connectToTitanWeWatch(peripheral);
    }
    if (isTitanWeFound) {
        noble.stopScanning();
    }
});

function subscribeToRssiUpdate(peripheral) {
    console.log('Subscribed to RSSI updates.')
    rssiUpdates = setInterval(() => {
        peripheral.updateRssi((error, rssi) => {
            if (error) {
                throw error;
                return;
            }
            if (rssi < 0) console.log("Titan WE RSSI: " + rssi);
        })
    }, 1000)
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
        if (rssiUpdates) {
            console.log('Unsubscribed to RSSI updates.')
            clearInterval(rssiUpdates);
            delete rssiUpdates;
        }
        isTitanWeFound = false;
        turnOFFLights();
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

noble.on('scanStart', () => {
    console.log('Scanning for devices...');
});

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
                // subscribeToRssiUpdate(titanWeWatch);
                characteristics[0].on('data', (data, isNotification) => buttonClickedOnTitanWEWatch(data, isNotification));
                turnONLights();
            });
        }
    });
}

function turnONLights() {
    console.log('Turning lights ON...');
    setTimeout(() => {
        switch1.writeSync(1);
        switch2.writeSync(1);
    }, TIME_DELAY_TO_TURN_LIGHTS_ON);
}

function turnOFFLights() {
    console.log('Turning lights OFF...');
    switch1.writeSync(0);
    switch2.writeSync(0);
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