export default class HomebridgeAccessory {
    constructor(log, config) {
        this.log = log;
        this.name = config.name;
        this.services = [];
    }

    getServices() {
        return this.services;
    }

    doGet(getValue) {
        return (callback) => {
            getValue()
                .then(v => callback(null, v))
                .catch((err) => {
                    this.log.error('get', err);
                    callback(err);
                });
        };
    }

    doSet(setValue) {
        return (value, callback) => {
            setValue(value)
                .then(v => callback(null, v))
                .catch((err) => {
                    this.log.error('set', err);
                    callback(err);
                });
        };
    }
}
