import { Accessory } from 'hap-nodejs';

export function doGet(getValue) {
    return (callback) => {
        getValue()
            .then(v => callback(null, v))
            .catch((err) => {
                console.error('get', err);
                callback(err);
            });
    };
}

export function doSet(setValue) {
    return (value, callback) => {
        setValue(value)
            .then(v => callback(null, v))
            .catch((err) => {
                console.error('set', err);
                callback(err);
            });
    };
}

export function createAccessory(name, uuid) {
    const accessory = new Accessory(name, uuid);
    accessory.on('identify', (paired, callback) => callback());
    return accessory;
}
