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

            if (this.log) this.log.debug('new data query');

            return fetch(`${this.server}`, {
                method: 'GET',
                ...defaultFetchOptions,
            })
            .then(response => response.json())
            .then(val => {
                queryResolved = true;
                queryFinished = true;
                if (this.log) this.log.debug('resolving queryWatchers');
                queryWatchers.forEach(([resolve]) => {
                    resolve(val);
                });
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
                    if (this.log) this.log.error(e);
                    if (this.log) this.log.debug('rejecting queryWatchers');
                    queryWatchers.forEach(([resolve, reject]) => {
                        reject(err);
                    });
                    queryWatchers = [];
                    throw e;
                }
            });
        }

        this.getStatus = () => {
            const p = new Promise((resolve, reject) => {
                queryWatchers.push([resolve, reject]);
            });

            if (queryResolved) {
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

    setColor(color) {
        return new Promise((resolve, reject) => {
            this.requestBuffer.next([ color, resolve, reject ]);
            this.requestDebounced.next(true);
        })
    }
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
            .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
            .on('get', (callback) => {
                blindObj.getStatus().then((data) => {
                    callback(null, data.luminance);
                }).catch(err => {
                    log.error(err);
                    callback(err);
                });
            });

        this.services = [
            lightSensorService
        ];

        for (let i = 0; i < blindObj.numBlinds; i++) {
            const coveringService = new Service.WindowCovering();
            coveringService
                .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
                .on('get', callback => {
                    blindObj.getStatus().then(data => {
                        callback(null, data.blinds[i].current);
                    }).catch(err => {
                        log.error(err);
                        callback(err);
                    });
                });
            coveringService
                .getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
                .on('get', callback => {
                    blindObj.getStatus().then(data => {
                        callback(null, data.blinds[i].target);
                    }).catch(err => {
                        log.error(err);
                        callback(err);
                    });
                })
                .on('set', (value, callback) => {
                    blindObj.seek(value).then(() => {
                        callback();
                    }).catch(callback);
                });
            // coveringService
            //     .getCharacteristic(Characteristic.ObstructionDetected)
            //     .on('get', callback => {
            //         blindObj.getStatus().then(data => {
            //             callback(null, data.blinds[i].obstructed);
            //         }).catch(err => {
            //             log.error(err);
            //             callback(err);
            //         });
            //     });

            this.services.push(coveringService);
        }
    }
}
