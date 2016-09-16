import fetch from 'node-fetch';

const defaultFetchOptions = {
    timeout: 500,
};

export default class SmartLight {
    constructor(server) {
        this.server = server;
    }

    async getStatus() {
        return fetch(`${this.server}/status`, {
            method: 'get',
            ...defaultFetchOptions,
        }).then(response => response.json());
    }

    async turnOff() {
        const response = await fetch(`${this.server}/off`, {
            method: 'get',
            ...defaultFetchOptions,
        });
        return await response.json;
    }

    async setColor(color) {
        const { r, g, b } = color;
        const response = await fetch(`${this.server}/color?r=${r}&g=${g}&b=${b}`, {
            method: 'post',
            ...defaultFetchOptions,
        });
        return await response.json;
    }
}
