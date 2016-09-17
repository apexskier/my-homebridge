import MagicMirror from './magicMirror'
import SmartLightAccessory from './smartLight'

export default function(homebridge) {
    homebridge.registerAccessory("homebridge-magicmirror", "MagicMirror", MagicMirror);
    homebridge.registerAccessory("homebridge-rgblight", "SmartLight", SmartLightAccessory);
}
