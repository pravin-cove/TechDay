
/**
 * WATCH CONTROLS
 * 
 * Titan WE watch 
 * Single Press (GOLD - WATCH 1) -> TURN ON/OFF both lights
 * Single Press (BLACK - WATCH 2) -> TURN ON/OFF TV
 * Double Press -> Start changing theme for every 5 seconds untill the next double press.
 * Long Press -> Increase brightness in steps (Brightness levels : 25, 125 254)
 * 
 * Titan WE Black watch
 * OnConnection - Turn ON both the lights
 * onDisconnection - Turn OFF both the lights
 *  
 */

/**
 * ULTRASONIC SENSOR 
 * 
 * Detect intreupt and change theme.
 */

/**
 * Imports for the project
 */
var noble = require('noble');
let huejay = require('huejay');
var Gpio = require('onoff').Gpio;
var statistics = require('math-statistics');
var usonic = require('mmm-usonic');

//FOR Socket connection
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

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
var DIFFERENCE_IN_DISTANCE = 110;
// RSSI update interval
var RSSI_UPDATE_INTERVAL = 2000;
var titanWE1RssiUpdates;
var titanWE2RssiUpdates;
//Titan WE watch - 1
var titanWE1;
var isTitanWe1Found = false;
var titanWE1MacAddress = '80eacd001524' //Gold Watch //80eacd000c4f
//Titan WE watch - 2
var titanWE2;
var isTitanWe2Found = false;
var titanWE2MacAddress = '80eacd0015b6' //Black Watch
//Services and Characterstics
var titanWEServiceUUID = '000056ef00001000800000805f9b34fb';
var titanWECharacterstic = '000034e200001000800000805f9b34fb';
//TIME DELAY TO TURN LIGHTS ON
var TIME_DELAY_TO_TURN_LIGHTS_ON = 5000;
//Define switch GPIO ports
var switch1 = new Gpio(17, 'out');
var switch2 = new Gpio(22, 'out');
var switch3 = new Gpio(27, 'out')
//Define a client for Philips Hue Bridge.
var hueBridgeClient;
var scenes = ['4D3uYqE5IYe40zf', '34XU-HrJjYBM8kf', '6wTv3VhY2R8rrKA', '9SF2SNewZPPSQvB', '2od-0fCcCifKfRo'];
var sceneNames = ['Read', 'Tropical twilight', 'Spring blossom', 'Savanna sunset', 'Arctic aurora'];
var sceneIndex = 0;
//Helpers variables
var isLightsON = false;
var isTvON = false
var THEME_CHANGE_INERVAL = 5000;
var changeTheme;
var isInChangeThemeMode = false;
var lightBrightness;
var GROUP_ID = 3;
// Port for socket
var PORT = process.env.PORT || 3000;
/**
 * Here we define sockect controls.
 */
io.on('connection', (socket) => {
    console.log('a user connected');

    broadcastStateChange();

    socket.on('disconnect',() => {
        console.log('user disconnected');
      });

      socket.on('update', (msg) => {
        var status = JSON.parse(msg);

        if(status['lights']) {
            if(!isLightsON) {
                turnONLights();
            }
        } else {
            if(isLightsON) {
                turnOFFLights();
            }
        }

        if(status['sequence']) {
            if(!isInChangeThemeMode) {
                changeSceneContinuously();
            }
        } else {
            if(isInChangeThemeMode) {
                changeSceneContinuously();
            }
        }

        if(status['tv']){
            if(!isTvON) {
                turnONTv();
            }
        } else {
            if(isTvON) {
                tutnOFFTv();
            }
        }

        if(status['isChangeBrightness']){
            toggleBrightness();
        }

        if(status['isChangeTheme']) {
            changeScene();
        }
      });
  });


http.listen(PORT, () => {
    console.log('Listening on:' + PORT);
});

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

    // process.stdout.clearLine();
    // process.stdout.cursorTo(0);

    if (distance < 0) {
        // process.stdout.write('Error: Measurement timeout.\n');
        // console.log('Error in measurement.');
    } else {
        // process.stdout.write('Distance: ' + distance.toFixed(2) + ' cm');
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
    // console.log(`${peripheral.advertisement.localName} discovered.`)
    if (peripheral.id == titanWE1MacAddress) {
        console.log('Titan WE watch 1 discovered.');
        isTitanWe1Found = true;
        titanWE1 = peripheral;
        connectToTitanWeWatch(titanWE1);
    } else if (peripheral.id == titanWE2MacAddress) {
        console.log('Titan WE watch 2 discovered.');
        isTitanWe2Found = true;
        titanWE2 = peripheral;
        connectToTitanWeWatch(titanWE2);
    }

    if (isTitanWe1Found && isTitanWe2Found) {
        console.log('Stopping BLE scan...')
        noble.stopScanning();
    }
});

/*
function subscribeToRssiUpdate(peripheral) {
    console.log('Subscribed to RSSI updates.')
    if (peripheral === titanWE1) {
        titanWE1RssiUpdates = setInterval(() => {
            peripheral.updateRssi((error, rssi) => {
                if (error) {
                    throw error;
                    return;
                }
                if (rssi < 0) {
                    console.log('Titan WE watch 1 -> ' + rssi)
                }
            })
        }, 1000)
    } else if (peripheral === titanWE2) {
        titanWE2RssiUpdates = setInterval(() => {
            peripheral.updateRssi((error, rssi) => {
                if (error) {
                    throw error;
                    return;
                }
                if (rssi < 0) {
                    console.log('Titan WE watch 1 -> ' + rssi)
                }
            })
        }, 1000)
    }
}
*/

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
                        // getAllGroup(); // TO GET ALL CONFIGURED ROOMS
                        getAllScenes(); // TO GET SCENES
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
        if (titanWeWatch === titanWE1) {
            console.log('       Titan WE watch 1 disconnected.');
            if (titanWE1RssiUpdates) {
                console.log('Unsubscribed to RSSI updates.')
                clearInterval(titanWE1RssiUpdates);
                delete titanWE1RssiUpdates;
            }
            delete titanWE1;
            isTitanWe1Found = false;
        } else if (titanWeWatch === titanWE2) {
            console.log('       Titan WE watch 2 disconnected.');
            if (titanWE2RssiUpdates) {
                console.log('Unsubscribed to RSSI updates.')
                clearInterval(titanWE2RssiUpdates);
                delete titanWE2RssiUpdates;
            }
            delete titanWE2;
            isTitanWe2Found = false;
            turnOFFLights();
            tutnOFFTv();
        }

        noble.startScanning();
    });
    titanWeWatch.connect((error) => {
        if (error) {
            throw error;
            return
        }
        if (titanWeWatch === titanWE1) {
            console.log('Connected to Titan We watch 1.');
        } else if (titanWeWatch === titanWE2) {
            console.log('Connected to Titan We watch 2.');
        }
        discoverTitanWEServices(titanWeWatch);
    });
}

noble.on('scanStart', () => {
    console.log('Scanning for devices...');
});

noble.on('scanStop', () => {
    console.log('BLE scan stopped...');
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
                // subscribeToRssiUpdate(titanWeWatch);
                if (titanWeWatch === titanWE1) {
                    characteristics[0].on('data', (data, isNotification) => handleButtonClick(data, isNotification));
                    console.log('Characteristics found for Titan WE watch 1.');
                    console.log('Titan WE watch 1 is connected and ready to be used.');
                } else if (titanWeWatch === titanWE2) {
                    characteristics[0].on('data', (data, isNotification) => handleButtonClickOnBrownWatch(data, isNotification));
                    console.log('Characteristics found for Titan WE watch 2.');
                    console.log('Titan WE watch 2 is connected and ready to be used.');
                    if (!isLightsON) {
                        turnONLightsAndTvWithDelay();
                    }
                }
                if (!isTitanWe2Found || !isTitanWe1Found) {
                    noble.startScanning();
                }
            });
        }
    });
}

function turnONLightsAndTvWithDelay() {
    console.log('Turning lights ON sequence initiated...');
    setTimeout(() => {
        console.log(`isTitanWE2Found: ${isTitanWe2Found}`);
        if (isTitanWe2Found) {
            console.log('Turning lights and TV ON...');
            isLightsON = true;
            isTvON = true;
            switch1.writeSync(1);
            switch2.writeSync(1);
            switch3.writeSync(1);
            broadcastStateChange();
        }
    }, TIME_DELAY_TO_TURN_LIGHTS_ON);
}

function turnONLights() {
    console.log('Turning lights ON...');
    isLightsON = true;
    switch1.writeSync(1);
    switch2.writeSync(1);
    broadcastStateChange();
}

function turnOFFLights() {
    console.log('Turning lights OFF...');
    isLightsON = false;
    switch1.writeSync(0);
    switch2.writeSync(0);
    broadcastStateChange();
}

function turnONTv() {
    console.log('Turning TV ON...');
    isTvON = true;
    switch3.writeSync(1);
    broadcastStateChange();
}

function tutnOFFTv() {
    console.log('Turning TV OFF...');
    isTvON = false;
    switch3.writeSync(0);
    broadcastStateChange();
}

function handleButtonClick(data, isNotification) {
    console.log(`Button pressed ${data} on Titan WE watch.`);
    switch (data.toString()) {
        case 'S1':
            if (!isLightsON) {
                turnONLights();
            } else {
                turnOFFLights();
            }
            break;
        case 'S2':
            changeSceneContinuously();
            break;
        case 'S3':
            toggleBrightness();
            break;
    }
}

function handleButtonClickOnBrownWatch(data, isNotification) {
    console.log(`Button pressed ${data} on Titan WE watch.`);
    switch (data.toString()) {
        case 'S1':
            if (!isTvON) {
                turnONTv();
            } else {
                tutnOFFTv();
            }
            break;
        case 'S2':
            changeSceneContinuously();
            break;
        case 'S3':
            toggleBrightness();
            break;
    }
}

function toggleBrightness() {
    var brightness;
    if (hueBridgeClient) {
        hueBridgeClient.groups.getAll()
            .then(groups => {
                for (let group of groups) {
                    if(group.id == GROUP_ID) {
                    brightness = group.brightness;
                    }
                }

                if (brightness <= 25) {
                    brightness = 125;
                } else if (brightness > 25 && brightness <= 125) {
                    brightness = 250;
                } else {
                    brightness = 25;
                }

                hueBridgeClient.groups.getById(GROUP_ID)
                    .then(group => {
                        group.brightness = brightness;
                        return hueBridgeClient.groups.save(group);
                    })
                    .then(group => {
                        console.log(`Group [${group.id}] was saved`);
                    })
                    .catch(error => {
                        console.log(error.stack);
                    });
            });
    }
}

function changeSceneContinuously() {
    if (hueBridgeClient && !isInChangeThemeMode) {
        console.log('Theme sequence started..')
        isInChangeThemeMode = true;
        changeScene();
        changeTheme = setInterval(() => {
            console.log(`Setting theme -> ${sceneNames[sceneIndex]}`)
            hueBridgeClient.groups.getById(GROUP_ID)
                .then(group => {
                    group.scene = scenes[sceneIndex];
                    return hueBridgeClient.groups.save(group);
                })
                .then(group => {
                    sceneIndex++;
                    if (sceneIndex === scenes.length) {
                        sceneIndex = 0;
                    }
                })
                .catch(error => {
                    console.log(error.stack);
                });
        }, THEME_CHANGE_INERVAL)
        broadcastStateChange();
    } else {
        if (changeTheme) {
            isInChangeThemeMode = false;
            console.log('Theme sequence ended..')
            clearInterval(changeTheme);
            delete changeTheme;
            broadcastStateChange();
        }
    }
}

function changeScene() {
    if (hueBridgeClient) {
        console.log(`Setting theme -> ${sceneNames[sceneIndex]}`)
        hueBridgeClient.groups.getById(GROUP_ID)
            .then(group => {
                group.scene = scenes[sceneIndex];
                return hueBridgeClient.groups.save(group);
            })
            .then(group => {
                sceneIndex++;
                if (sceneIndex === scenes.length) {
                    sceneIndex = 0;
                }
            })
            .catch(error => {
                console.log(error.stack);
            });
    } else {
        if (changeTheme) {
            delete changeTheme;
        }
    }
}

function broadcastStateChange() {
    var result = { 
        status: 'OK',
        tv: isTvON,
        lights: isLightsON,
        sequence: isInChangeThemeMode,
      }
      io.sockets.emit('message', result);
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

function getAllGroup() {
    hueBridgeClient.groups.getAll()
  .then(groups => {
    for (let group of groups) {
      console.log(`Group [${group.id}]: ${group.name}`);
      console.log(`  Type: ${group.type}`);
      console.log(`  Class: ${group.class}`);
      console.log('  Light Ids: ' + group.lightIds.join(', '));
      console.log();
    }
  });
}

function getAllScenes() {
    hueBridgeClient.scenes.getAll()
  .then(scenes => {
    for (let scene of scenes) {
      console.log(`Scene [${scene.id}]: ${scene.name}`);
      console.log('  Lights:', scene.lightIds.join(', '));
      console.log();
    }
  });
}