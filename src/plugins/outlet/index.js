import fetch from 'node-fetch';
import { Characteristic, Service } from 'hap-nodejs';

import HomebridgeAccessory from '../homebridgeAccessory';
import pkg from './package.json';
import globalInfo from '../../globalInfo';
import DeviceManager from '../deviceManager';


export class Switch extends DeviceManager {
    // reverse -- I programed the "open" circuit logic backwards in my switch,
    // this allows me to fix it homebridge side so I don't have to break open
    // the box to flash new firmware.
    constructor(server, log, reverse = false) {
        super(server, log);

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

export default class OutletAccessory extends HomebridgeAccessory {
    constructor(log, config) {
        super(log, config);

        const obj = new Switch('http://10.0.1.6', log, true);

        const info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Name, this.name);
        info.setCharacteristic(Characteristic.Manufacturer, globalInfo.Manufacturer);
        info.setCharacteristic(Characteristic.Model, pkg.name);
        info.setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

        const outletService = new Service.Outlet();
        outletService
            .getCharacteristic(Characteristic.On)
            .on('get', this.doGet(() => obj.getStatus().then(data => (this.reverse ? !data.open : data.open))))
            .on('set', this.doSet(value => obj.set(value)));
        outletService.setCharacteristic(Characteristic.OutletInUse, true);

        this.services = [
            outletService,
        ];
    }
}

