import fetch from 'node-fetch';
import { Characteristic, Service } from 'hap-nodejs';
import 'rxjs/add/operator/bufferWhen';

import HomebridgeAccessory from '../homebridgeAccessory';
import pkg from './package.json';
import globalInfo from '../../globalInfo';
import DeviceManager from '../deviceManager';


export class Blinds extends DeviceManager {
    constructor(server, log, numBlinds) {
        super(server, log);

        this.numBlinds = numBlinds;
    }

    stop() {
        return fetch(`${this.server}/stop`, {
            method: 'POST',
            ...this.defaultFetchOptions,
        });
    }

    seek(position, force = false) {
        return fetch(`${this.server}/?v=${position}${force ? '&f=*' : ''}`, {
            method: 'POST',
            ...this.defaultFetchOptions,
        });
    }
}

const minAngle = 50;
const maxAngle = 300;
const midAngle = (maxAngle + minAngle) / 2;

function cleanValueTilt(v) {
    let r = v;
    r = (v - minAngle) / (maxAngle - minAngle);
    r = (r * 180) - 90;
    return Math.min(90, Math.max(-90, Math.round(r)));
}

function uncleanValueTilt(v) {
    let r = v;
    r = (v + 90) / 180;
    r = (r * (maxAngle - minAngle)) + minAngle;
    return Math.min(maxAngle, Math.max(minAngle, Math.round(r)));
}

function cleanValueOpen(v) {
    let r = v;
    r = (r - minAngle) / (midAngle - minAngle);
    r *= 100;
    return Math.min(100, Math.max(0, Math.round(r)));
}

function uncleanValueOpen(v) {
    let r = v;
    r /= 100;
    r = (r * (midAngle - minAngle)) + minAngle;
    return Math.min(maxAngle, Math.max(minAngle, Math.round(r)));
}


export default class BlindsAccessory extends HomebridgeAccessory {
    constructor(log, config) {
        super(log, config);

        const blindObj = new Blinds('http://10.0.1.5', log, 1);

        const info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Name, this.name);
        info.setCharacteristic(Characteristic.Manufacturer, globalInfo.Manufacturer);
        info.setCharacteristic(Characteristic.Model, pkg.name);
        info.setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

        const lightSensorService = new Service.LightSensor();
        lightSensorService
            .getCharacteristic(Characteristic.CurrentAmbientLightLevel);

        (function lightSensorLoop() {
            lightSensorService
                .setCharacteristic(Characteristic.StatusActive, true);
            blindObj.getStatus().then((data) => {
                lightSensorService
                    .setCharacteristic(Characteristic.CurrentAmbientLightLevel, data.luminance);
                setTimeout(lightSensorLoop, 10000);
            }).catch((err) => {
                lightSensorService
                    .setCharacteristic(Characteristic.StatusActive, false);
                setTimeout(lightSensorLoop, 10000);
                log.error(err);
            });
        }());

        this.services = [
            lightSensorService,
        ];

        for (let i = 0; i < blindObj.numBlinds; i += 1) {
            const coveringService = new Service.WindowCovering();
            coveringService
                .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
                .on('get', this.doGet(() => blindObj.getStatus().then(data => cleanValueTilt(data.blinds[i].current))));
            coveringService
                .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
                .on('get', this.doGet(() => blindObj.getStatus().then(data => cleanValueTilt(data.blinds[i].target))))
                .on('set', this.doSet(value => blindObj.seek(uncleanValueTilt(value))));
            coveringService
                .getCharacteristic(Characteristic.CurrentPosition)
                .on('get', this.doGet(() => blindObj.getStatus().then(data => cleanValueOpen(data.blinds[i].current))));
            coveringService
                .getCharacteristic(Characteristic.TargetPosition)
                .on('get', this.doGet(() => blindObj.getStatus().then((data) => {
                    const target = data.blinds[i].target;
                    const current = data.blinds[i].current;
                    const cleanTarget = cleanValueOpen(target);
                    const cleanCurrent = cleanValueOpen(current);
                    if (Math.abs(target - current) > 10) {
                        return cleanTarget;
                    }
                    return cleanCurrent;
                })))
                .on('set', this.doSet(value => blindObj.seek(uncleanValueOpen(value))));
            coveringService
                .getCharacteristic(Characteristic.PositionState)
                .on('get', this.doGet(() => blindObj.getStatus.then((data) => {
                    switch (data.blinds[i].moving) {
                    case 'stopped':
                        return Characteristic.PositionState.STOPPED;
                    case 'positive':
                        return Characteristic.PositionState.INCREASING;
                    case 'negative':
                        return Characteristic.PositionState.DECREASING;
                    default:
                        throw Error('unexpected PositionState');
                    }
                })));
            coveringService
                .getCharacteristic(Characteristic.ObstructionDetected)
                .on('get', this.doGet(() => blindObj.getStatus().then(data => data.blinds[i].obstructed)));

            this.services.push(coveringService);
        }
    }
}

