import fetch from 'node-fetch';


export default class DeviceManager {
    infoPath = '';

    defaultFetchOptions = {
        timeout: 2000,
    };

    constructor(server, log) {
        this.server = server;
        this.log = log;

        let queryWatchers = [];
        let queryFinished = true;

        const newQuery = (i = 0) => {
            queryFinished = false;

            return fetch(`${this.server}/${this.infoPath}`, {
                method: 'GET',
                ...this.defaultFetchOptions,
            })
            .then(r => r.json())
            .then((val) => {
                queryFinished = true;
                queryWatchers.forEach(([resolve]) => resolve(val));
                queryWatchers = [];
                return val;
            })
            .catch((err) => {
                if (i > 4) {
                    if (this.log) this.log.warn(`retrying data query for ${this.constructor.name}`);
                    return newQuery(i + 1);
                }
                queryFinished = true;
                if (this.log) this.log.error(err);
                queryWatchers.forEach(([resolve, reject]) => reject(err)); // eslint-disable-line no-unused-vars
                queryWatchers = [];
                throw err;
            });
        };

        this.getStatus = () => {
            const p = new Promise((resolve, reject) => {
                queryWatchers.push([resolve, reject]);
            });

            if (queryFinished) {
                newQuery();
            }

            return p;
        };
    }
}

