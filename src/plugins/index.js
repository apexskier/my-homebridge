import MagicMirror from './magicMirror';
import SmartLightAccessory from './smartLight';
import BlindsAccessory from './blinds';

export default function (homebridge) {
    homebridge.registerAccessory('homebridge-magicmirror', 'MagicMirror', MagicMirror);
    homebridge.registerAccessory('homebridge-rgblight', 'SmartLight', SmartLightAccessory);
    homebridge.registerAccessory('homebridge-blinds', 'Blinds', BlindsAccessory);
}
