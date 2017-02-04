import fetch from 'node-fetch';
// import husl from 'husl';
import { Characteristic, Service } from 'hap-nodejs';
import Rx from 'rxjs';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/bufferWhen';

import HomebridgeAccessory from '../homebridgeAccessory';
import pkg from './package.json';
import globalInfo from '../../globalInfo';
import DeviceManager from '../deviceManager';


/* eslint-disable */
/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR
 * h, s, v
*/
function hsvToRgb(h, s, v) {
    let r,
        g,
        b,
        i,
        f,
        p,
        q,
        t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

/* accepts parameters
 * r  Object = {r:x, g:y, b:z}
 * OR
 * r, g, b
*/
function rgbToHsv(r, g, b) {
    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    let max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
    case min: h = 0; break;
    case r: h = (g - b) + (d * (g < b ? 6 : 0)); h /= 6 * d; break;
    case g: h = (b - r) + (d * 2); h /= 6 * d; break;
    case b: h = (r - g) + (d * 4); h /= 6 * d; break;
    }

    return {
        h,
        s,
        v,
    };
}
/* eslint-enable */

export class SmartLight extends DeviceManager {
    infoPath = 'status';

    constructor(server, log, debounceTime = 500) {
        super(server, log);

        this.debounceTime = debounceTime;
        this.lastColor = { h: 0, s: 0, v: 100 };

        this.requestDebounced = new Rx.Subject();
        this.requestBuffer = new Rx.Subject();
        this.requestBuffer.bufferWhen(() => this.requestDebounced.debounceTime(this.debounceTime))
        .subscribe((colorArray) => {
            const resolvers = colorArray.map(val => val[1]);
            const rejecters = colorArray.map(val => val[2]);
            const color = colorArray.map(val => val[0]).reduce((prev, cur) => ({
                ...cur,
                ...prev,
            }), {});
            this.getColor()
            .then((currentColor) => {
                const { h = currentColor.h, s = currentColor.s, v = currentColor.v } = color;
                // const [r, g, b] = husl.toRGB(h, s, l)
                //     .map(comp => Math.min(255, Math.max(0, Math.round(comp * 255))));
                const { r, g, b } = hsvToRgb(h / 360, s / 100, v / 100);
                this.log.debug('setting color', { h, s, v }, { r, g, b });
                this.log.debug(`${this.server}/color?duration=${this.debounceTime}&r=${r}&g=${g}&b=${b}`);
                return fetch(`${this.server}/color?duration=${this.debounceTime}&r=${r}&g=${g}&b=${b}`, {
                    method: 'POST',
                    ...this.defaultFetchOptions,
                }).then(res => res.json());
            })
            .then((data) => {
                // const [h, s, l] = husl.fromRGB(data.r / 255, data.g / 255, data.b / 255);
                let { h, s, v } = rgbToHsv(data);
                h *= 360;
                s *= 100;
                v *= 100;
                this.lastColor = { h, s, v };
                resolvers.forEach(r => r(data));
            })
            .catch((err) => {
                rejecters.forEach(r => r(err));
            });
        });
    }

    getColor() {
        return this.getStatus()
        .then((data) => {
            const { r, g, b } = data.color;
            let { h, s, v } = rgbToHsv(data.color);
            h *= 360;
            s *= 100;
            v *= 100;
            this.log.debug('in getColor returning', { h, s, v }, { r, g, b });
            if (data.on) {
                this.lastColor = { h, s, v };
            }
            return { h, s, v };
        });
    }

    turnOff() {
        return fetch(`${this.server}/off`, {
            method: 'GET',
            ...this.defaultFetchOptions,
        })
        .then(r => r.json());
    }

    turnOn() {
        return this.setColor(this.lastColor);
    }

    setColor(color) {
        return new Promise((resolve, reject) => {
            this.requestBuffer.next([color, resolve, reject]);
            this.requestDebounced.next(true);
        });
    }
}

export default class SmartLightAccessory extends HomebridgeAccessory {
    constructor(log, config) {
        super(log, config);

        const rgbLight = new SmartLight('http://10.0.1.4', log);

        const info = new Service.AccessoryInformation();
        info.setCharacteristic(Characteristic.Name, this.name);
        info.setCharacteristic(Characteristic.Manufacturer, globalInfo.Manufacturer);
        info.setCharacteristic(Characteristic.Model, pkg.name);
        info.setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

        const rgbLightService = new Service.Lightbulb();
        rgbLightService
            .setCharacteristic(Characteristic.Name, 'Bedside Light');
        rgbLightService
            .getCharacteristic(Characteristic.On)
            .on('get', this.doGet(() => rgbLight.getStatus().then(d => d.on)))
            .on('set', this.doSet((state) => {
                if (state) {
                    return rgbLight.turnOn();
                }
                return rgbLight.turnOff();
            }));

        rgbLightService
            .getCharacteristic(Characteristic.Brightness)
            .on('get', this.doGet(() => rgbLight.getColor().then(({ v }) => v)))
            .on('set', this.doSet(v => rgbLight.setColor({ v })));

        rgbLightService
            .getCharacteristic(Characteristic.Saturation)
            .on('get', this.doGet(() => rgbLight.getColor().then(({ s }) => s)))
            .on('set', this.doSet(s => rgbLight.setColor({ s })));

        rgbLightService
            .getCharacteristic(Characteristic.Hue)
            .on('get', this.doGet(() => rgbLight.getColor().then(({ h }) => h)))
            .on('set', this.doSet(h => rgbLight.setColor({ h })));

        this.services = [
            rgbLightService,
        ];
    }
}

