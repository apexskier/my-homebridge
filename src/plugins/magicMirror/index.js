import { Characteristic, Service } from 'hap-nodejs'
import pkg from './package.json'
import globalInfo from '../../globalInfo'

export default class MagicMirror {
    constructor(log, config) {
        this.log = log;
        this.name = config['name'];

        const info = new Service.AccessoryInformation()
        info.setCharacteristic(Characteristic.Name, this.name);
        info.setCharacteristic(Characteristic.Manufacturer, globalInfo.Manufacturer);
        info.setCharacteristic(Characteristic.Model, pkg.name);
        info.setCharacteristic(Characteristic.SerialNumber, config['serial']);
        info.setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

        const lightSensorService = new Service.LightSensor(`${this.name} Light Sensor`);
        lightSensorService
            .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
            .on('get', this.getLight.bind(this));

        const motionSensorService = new Service.MotionSensor(`${this.name} Motion Sensor`);
        motionSensorService
            .setCharacteristic(Characteristic.StatusActive, true);
        motionSensorService
            .getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.getMotion.bind(this));

        this.services = [
            info,
            lightSensorService,
            motionSensorService,
        ];
    }

    getServices() {
        return this.services;
    }

    getMotion(callback) {
        this.log.debug('Get motion');
        callback(null, false);
    }

    getLight(callback) {
        this.log.debug('Get light');
        var r = Math.random() * 1000000001 / 10000;
        callback(null, Number(r));
    }
}

