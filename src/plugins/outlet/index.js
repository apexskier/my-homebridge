import fetch from 'node-fetch';
import { Characteristic, Service } from 'hap-nodejs';

import { createAccessory, doGet, doSet } from '../accessory';
import pkg from './package.json';
import DeviceManager from '../deviceManager';


class Switch extends DeviceManager {
    // reverse -- I programed the "open" circuit logic backwards in my switch,
    // this allows me to fix it homebridge side so I don't have to break open
    // the box to flash new firmware.
    constructor(server, reverse = false) {
        super(server);

        this.reverse = reverse;
    }

    set(on) {
        if (this.reverse) {
            on = !on; // eslint-disable-line no-param-reassign
        }
        return fetch(`${this.server}/?open=${on ? 'false' : 'true'}`, {
            method: 'POST',
            ...this.defaultFetchOptions,
        })
        .then(r => r.ok);
    }
}

const reverse = true;

const obj = new Switch('http://10.0.1.6', reverse);
const outletAccessory = createAccessory('Outlet', 'a104101d-d7ba-4b24-86a7-73fea9b108b1');

outletAccessory
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, 'apexskier')
    .setCharacteristic(Characteristic.Model, pkg.name)
    .setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

const outletService = outletAccessory
    .addService(Service.Outlet);
outletService
    .setCharacteristic(Characteristic.OutletInUse, true);
outletService
    .getCharacteristic(Characteristic.On)
    .on('get', doGet(() => obj.getStatus().then(data => (reverse ? data.open : !data.open))))
    .on('set', doSet(value => obj.set(value)));

export default outletAccessory;
