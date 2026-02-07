const Device = require("../models/Device");

const deviceOwnerMap = {};

async function loadDevices() {
  const devices = await Device.find();
  for (const d of devices) {
    deviceOwnerMap[d.deviceId] = d.userId.toString();
  }
}

module.exports = { deviceOwnerMap, loadDevices };
