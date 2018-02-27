/*
  Continously scans for peripherals and prints out message when they enter/exit
    In range criteria:      RSSI < threshold
    Out of range criteria:  lastSeen > grace period
  based on code provided by: Mattias Ask (http://www.dittlof.com)
*/
var noble = require('noble');

var RSSI_THRESHOLD    = -90;
var EXIT_GRACE_PERIOD = 15000; // milliseconds

var inRange = [];

noble.on('discover', function(peripheral) {
  if (peripheral.rssi < RSSI_THRESHOLD && peripheral.id == '80eacd000c4f') {
    // ignore
    return;
  }

  var id = peripheral.id;
  var entered = !inRange[id];

  if (entered) {
    inRange[id] = {
      peripheral: peripheral
    };

    console.log('"' + peripheral.advertisement.localName + '" entered (RSSI ' + peripheral.rssi + ') ' + new Date());
  }

  inRange[id].lastSeen = Date.now();
});

setInterval(function() {
  for (var id in inRange) {
    if (inRange[id].lastSeen < (Date.now() - EXIT_GRACE_PERIOD)) {
      var peripheral = inRange[id].peripheral;

      console.log('"' + peripheral.advertisement.localName + '" exited (RSSI ' + peripheral.rssi + ') ' + new Date());

      delete inRange[id];
    }
  }
}, EXIT_GRACE_PERIOD / 2);

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning([], false);
  } else {
    noble.stopScanning();
  }
});