import { Characteristic, Service } from 'hap-nodejs';

import pkg from './package.json';
import globalInfo from '../../globalInfo';
import HomebridgeAccessory from '../homebridgeAccessory';
import createPowerService from './power.js';
import createMotionSensorService from './motion.js';


export default class MagicMirror extends HomebridgeAccessory {
    constructor(log, config) {
        super(log, config);

        const info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Name, this.name);
        info.setCharacteristic(Characteristic.Manufacturer, globalInfo.Manufacturer);
        info.setCharacteristic(Characteristic.Model, pkg.name);
        info.setCharacteristic(Characteristic.SerialNumber, config.serial);
        info.setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

        const magicMirrorPowerService = createPowerService(this.name, this.log);

        const motionSensorServices = createMotionSensorService(this.name, this.log, 8104);

        // const lightSensorService = new Service.LightSensor(`Light Sensor`);
        // lightSensorService
        //     .setCharacteristic(Characteristic.StatusActive, false);

        this.services = [
            info,
            magicMirrorPowerService,
            // lightSensorService,
            ...motionSensorServices,
        ];
    }
}

