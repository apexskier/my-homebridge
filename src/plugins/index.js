import MagicMirror from './magicMirror'

export default function(homebridge) {
    homebridge.registerAccessory("homebridge-magicmirror", "MagicMirror", MagicMirror);
    // homebridge.registerAccessory("homebridge-rgblight", "SmartLight", SmartLight);
}
