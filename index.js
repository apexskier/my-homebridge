import SmartLight from './plugins/smartLight';

const light = new SmartLight('http://10.0.1.4');
light.getStatus().then((data) => {
    console.log(JSON.stringify(data));
}).catch((err) => {
    console.warn(err);
});
