import chalk from 'chalk';
import { Bridge, Accessory, Service, Characteristic } from 'hap-nodejs';
import storage from 'node-persist'; // NOTE: don't add this as a separate dependency, since hap-nodejs uses an old version internally

import pkg from './package.json';
import outlet from './outlet';
import smartlight from './smartLight';
import blinds from './blinds';

const mac = 'CC:22:3D:E3:CE:F6';
const pin = '934-65-122';
const bridgeUUID = 'bf286d28-a28d-4fbf-8ead-ed829fbd7c15';

console.log('Scan this code with your HomeKit App on your iOS device to pair with Homebridge:');
console.log(chalk.black.bgWhite(`

                       
    ┌────────────┐     
    │ ${((pin))} │     
    └────────────┘     
                       
`));

// Initialize our storage system
storage.initSync();

// Start by creating our Bridge which will host all loaded Accessories
const bridge = new Bridge('Node Bridge', bridgeUUID);

// Listen for bridge identification event
bridge.on('identify', (paired, callback) => {
    callback(); // success
});

bridge
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, 'apexskier')
    .setCharacteristic(Characteristic.Model, pkg.name)
    .setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

// Publish the Bridge on the local network.
bridge.publish({
    username: mac,
    port: 51826,
    pincode: pin,
    category: Accessory.Categories.BRIDGE,
});

bridge.addBridgedAccessory(outlet);
bridge.addBridgedAccessory(smartlight);
bridge.addBridgedAccessory(blinds);


const accessory = new Accessory('something else Switch', '9a360c1e-53fc-4f63-87bb-909280a16ded');
accessory.on('identify', (paired, callback) => callback());

const switchService = accessory
    .addService(Service.Doorbell);
switchService
    .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
    .on('get', callback => callback(null, 0));

bridge.addBridgedAccessory(accessory);
