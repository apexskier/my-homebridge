export default class HomebridgeAccessory {
    constructor(log, config) {
        this.log = log;
        this.name = config['name'];
        this.services = [];
    }

    getServices() {
        return this.services;
    }
}
