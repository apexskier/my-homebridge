import fetch from 'node-fetch';
import { Characteristic, Service } from 'hap-nodejs';
import 'rxjs/add/operator/bufferWhen';

import { createAccessory, doGet, doSet } from '../accessory';
import pkg from './package.json';
import DeviceManager from '../deviceManager';


export class Blinds extends DeviceManager {
    constructor(server, numBlinds) {
        super(server);

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


const blindObj = new Blinds('http://10.0.1.5', 1);
const blindsAccessory = createAccessory('Blinds', 'c3fc6778-d746-450a-b412-84f517cb8d80');

blindsAccessory
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, 'apexskier')
    .setCharacteristic(Characteristic.Model, pkg.name)
    .setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

const lightSensorService = blindsAccessory
    .addService(Service.LightSensor);
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
        console.error(err);
    });
}());

for (let i = 0; i < blindObj.numBlinds; i += 1) {
    const coveringService = blindsAccessory
        .addService(Service.WindowCovering);
    coveringService
        .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
        .on('get', doGet(() => blindObj.getStatus().then(data => cleanValueTilt(data.blinds[i].current))));
    coveringService
        .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
        .on('get', doGet(() => blindObj.getStatus().then(data => cleanValueTilt(data.blinds[i].target))))
        .on('set', doSet(value => blindObj.seek(uncleanValueTilt(value))));
    coveringService
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', doGet(() => blindObj.getStatus().then(data => cleanValueOpen(data.blinds[i].current))));
    coveringService
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', doGet(() => blindObj.getStatus().then((data) => {
            const target = data.blinds[i].target;
            const current = data.blinds[i].current;
            const cleanTarget = cleanValueOpen(target);
            const cleanCurrent = cleanValueOpen(current);
            if (Math.abs(target - current) > 10) {
                return cleanTarget;
            }
            return cleanCurrent;
        })))
        .on('set', doSet(value => blindObj.seek(uncleanValueOpen(value))));
    coveringService
        .getCharacteristic(Characteristic.PositionState)
        .on('get', doGet(() => blindObj.getStatus.then((data) => {
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
        .on('get', doGet(() => blindObj.getStatus().then(data => data.blinds[i].obstructed)));
}

export default blindsAccessory;
