import { Characteristic, Service } from 'hap-nodejs'
import { exec } from 'child_process';

import pkg from './package.json'
import globalInfo from '../../globalInfo'
import HomebridgeAccessory from '../homebridgeAccessory'


const VC_SDTV_UNPLUGGED          = 1 << 16; // SDTV cable unplugged, subject to platform support
const VC_SDTV_ATTACHED           = 1 << 17; // SDTV cable is plugged in
const VC_SDTV_NTSC               = 1 << 18; // SDTV is in NTSC mode
const VC_SDTV_PAL                = 1 << 19; // SDTV is in PAL mode
const VC_SDTV_CP_INACTIVE        = 1 << 20; // Copy protection disabled
const VC_SDTV_CP_ACTIVE          = 1 << 21; // Copy protection enabled

const VC_HDMI_UNPLUGGED          = 1 << 0;  // HDMI cable is detached
const VC_HDMI_ATTACHED           = 1 << 1;  // HDMI cable is attached but not powered on
const VC_HDMI_DVI                = 1 << 2;  // HDMI is on but in DVI mode (no audio)
const VC_HDMI_HDMI               = 1 << 3;  // HDMI is on and HDMI mode is active
const VC_HDMI_HDCP_UNAUTH        = 1 << 4;  // HDCP authentication is broken (e.g. Ri mismatched) or not active
const VC_HDMI_HDCP_AUTH          = 1 << 5;  // HDCP is active
const VC_HDMI_HDCP_KEY_DOWNLOAD  = 1 << 6;  // HDCP key download successful/fail
const VC_HDMI_HDCP_SRM_DOWNLOAD  = 1 << 7;  // HDCP revocation list download successful/fail
const VC_HDMI_CHANGING_MODE      = 1 << 8;  // HDMI is starting to change mode, clock has not yet been set

export default class MagicMirror extends HomebridgeAccessory {
    constructor(log, config) {
        super(log, config);

        const info = new Service.AccessoryInformation()
        info.setCharacteristic(Characteristic.Name, this.name);
        info.setCharacteristic(Characteristic.Manufacturer, globalInfo.Manufacturer);
        info.setCharacteristic(Characteristic.Model, pkg.name);
        info.setCharacteristic(Characteristic.SerialNumber, config['serial']);
        info.setCharacteristic(Characteristic.SoftwareRevision, pkg.version);

        const magicMirrorPowerService = new Service.Switch(this.name);
        magicMirrorPowerService
            .getCharacteristic(Characteristic.On)
            .on('get', (callback) => {
                exec('tvservice -s', (err, stdout, stderr) => {
                    if (err) {
                        callback(err);
                    } else {
                        this.log.debug(err, stdout, stderr);
                        const state = parseInt(stdout.split(/\s/)[1]);
                        this.log.debug(state);
                        if (state & (VC_HDMI_HDMI | VC_HDMI_DVI)) {
                            callback(null, true);
                        } else if (state & (VC_HDMI_UNPLUGGED | VC_HDMI_ATTACHED)) {
                            callback(null, false);
                        } else {
                            const err = new Error('Unhandled tv state', state);
                            this.log.error(err);
                            callback(err);
                        }
                    }
                });
            })
            .on('set', (on, callback) => {
                const cmd = `tvservice -${on ? 'p' : 'o'}`;
                exec(cmd, (err, stdout, stderr) => {
                    if (err) {
                        this.log.error(err);
                        callback(err);
                    } else {
                        this.log.debug(stdout, stderr);
                        callback(null, stdout);
                    }
                });
            });

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
            magicMirrorPowerService,
            lightSensorService,
            motionSensorService,
        ];
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

