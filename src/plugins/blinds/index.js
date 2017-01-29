import fetch from 'node-fetch'
import husl from 'husl';
import { Characteristic, Service } from 'hap-nodejs'
import Rx from 'rxjs'
import 'rxjs/add/operator/debounceTime'
import 'rxjs/add/operator/bufferWhen'

import HomebridgeAccessory from '../homebridgeAccessory'
import pkg from './package.json'
import globalInfo from '../../globalInfo'


const defaultFetchOptions = {
    timeout: 2000,
};

export class Blinds {
    constructor(server, numBlinds, log, debounceTime = 500) {
        this.server = server;
        this.log = log;
        this.debounceTime = debounceTime;
        this.numBlinds = numBlinds;

        let queryWatchers = [];
        let queryResolved = true;
        let queryRejected = true;
        let queryFinished = true;

        const newQuery = (i = 0) => {
            queryResolved = false;
            queryRejected = false;
            queryFinished = false;

            return fetch(`${this.server}`, {
                method: 'GET',
                ...defaultFetchOptions,
            })
            .then(r => r.json())
            .then(val => {
                queryResolved = true;
                queryFinished = true;
                queryWatchers.forEach(([resolve, reject]) => resolve(val));
                queryWatchers = [];
                return val;
            })
            .catch(err => {
                if (i > 4) {
                    if (this.log) this.log.warn('retrying data query');
                    return newQuery(i + 1);
                } else {
                    queryRejected = true;
                    queryFinished = true;
                    if (this.log) this.log.error(err);
                    queryWatchers.forEach(([resolve, reject]) => reject(err));
                    queryWatchers = [];
                    throw err;
                }
            });
        }

        this.getStatus = () => {
            const p = new Promise((resolve, reject) => {
                queryWatchers.push([resolve, reject]);
            });

            if (queryFinished) {
                newQuery();
            }

            return p;
        }
    }

    stop() {
        return fetch(`${this.server}/stop`, {
            method: 'POST',
            ...defaultFetchOptions,
        });
    }

    seek(position, force = false) {
        return fetch(`${this.server}/?v=${position}${force ? '&f=*' : ''}`, {
            method: 'POST',
            ...defaultFetchOptions,
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
    r = r * 100;
    r = r * 2;
    return Math.min(100, Math.max(0, Math.round(r)));
}

function uncleanValueOpen(v) {
    let r = v;
    r = r / 100;
    r = r / 2
    r = (r * (midAngle - minAngle)) + minAngle;
    return Math.min(maxAngle, Math.max(minAngle, Math.round(r)));
}


export default class BlindsAccessory extends HomebridgeAccessory {
    constructor(log, config) {
        super(log, config);

        const blindObj = new Blinds('http://10.0.1.5', 1, log);

        const info = new Service.AccessoryInformation()
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
            }).catch(err => {
                log.error(err);
                setTimeout(lightSensorLoop, 10000);
                lightSensorService
                    .setCharacteristic(Characteristic.StatusActive, false);
            });
        })();

        for (let i = 0; i < blindObj.numBlinds; i++) {
            const coveringService = new Service.WindowCovering();
            coveringService
                .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
                .on('get', callback => {
                    blindObj.getStatus().then(data => {
                        callback(null, cleanValueTilt(data.blinds[i].current));
                    }).catch((err) => {
                        log.error(err);
                        callback(err);
                    });
                });
            coveringService
                .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
                .on('get', callback => {
                    blindObj.getStatus().then(data => {
                        callback(null, cleanValueTilt(data.blinds[i].target));
                    }).catch((err) => {
                        log.error(err);
                        callback(err);
                    });
                })
                .on('set', (value, callback) => {
                    log.debug(`tilting blinds to ${value} ${uncleanValueTilt(value)}`);
                    blindObj.seek(uncleanValueTilt(value)).then(() => {
                        callback();
                    }).catch((err) => {
                        log.error(err);
                        callback('error');
                    });
                });
            coveringService
                .getCharacteristic(Characteristic.CurrentPosition)
                .on('get', callback => {
                    log.info('in CurrentPosition get');
                    blindObj.getStatus().then(data => {
                        log.info(`current value: ${data.blinds[i].current}, ${cleanValueOpen(data.blinds[i].current)}`);
                        callback(null, cleanValueOpen(data.blinds[i].current));
                    }).catch((err) => {
                        log.error(err);
                        callback(err);
                    });
                });
            coveringService
                .getCharacteristic(Characteristic.TargetPosition)
                .on('get', callback => {
                    blindObj.getStatus().then(data => {
                        const target = data.blinds[i].target;
                        const current = data.blinds[i].current;
                        const cleanTarget = cleanValueOpen(target);
                        const cleanCurrent = cleanValueOpen(current)
                        log.info(`target value: ${data.blinds[i].target}, ${cleanTarget}`);
                        if (Math.abs(target - current) > 10) {
                            callback(null, cleanTarget);
                        } else {
                            callback(null, cleanCurrent);
                        }
                    }).catch((err) => {
                        log.error(err);
                        callback(err);
                    });
                })
                .on('set', (value, callback) => {
                    log.debug(`seeking blinds to ${uncleanValueOpen(value)}`);
                    blindObj.seek(uncleanValueOpen(value)).then(() => {
                        callback();
                    }).catch((err) => {
                        log.error(err);
                        callback('error');
                    });
                });
            coveringService
                .getCharacteristic(Characteristic.PositionState)
                .on('get', callback => {
                    log.info('PositionState get called');
                    blindObj.getStatus().then(data => {
                        switch (data.blinds[i].moving) {
                            case "stopped":
                                callback(null, Characteristic.PositionState.STOPPED);
                                break;
                            case "positive":
                                callback(null, Characteristic.PositionState.INCREASING);
                                break;
                            case "negative":
                                callback(null, Characteristic.PositionState.DECREASING);
                                break;
                            default:
                                log.warn('positionstate unexpected');
                                callback('something unexpected');
                        }
                    }).catch(err => {
                        log.error(err);
                        callback(err);
                    });
                });;
            coveringService
                .getCharacteristic(Characteristic.ObstructionDetected)
                .on('get', callback => {
                    blindObj.getStatus().then(data => {
                        callback(null, data.blinds[i].obstructed);
                    }).catch(err => {
                        log.error(err);
                        callback(err);
                    });
                });

            this.services = [
                lightSensorService,
                coveringService,
            ];
        }
    }
}

