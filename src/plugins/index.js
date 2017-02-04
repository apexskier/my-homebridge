/* eslint-disable global-require */

import fs from 'fs';
import path from 'path';

export default function (homebridge) {
    fs.readdirSync(__dirname)
        .map(file => path.join(__dirname, file))
        .filter(file => fs.statSync(file).isDirectory())
        .forEach((file) => {
            const packageName = require(path.join(file, 'package.json')).name;
            homebridge.registerAccessory(packageName, packageName, require(file).default);
        });
}
