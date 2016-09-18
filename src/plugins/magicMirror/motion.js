import { Characteristic, Service } from 'hap-nodejs'
import Rx from 'rxjs'
import socketIO from 'socket.io'

export default function create(name, log, port) {
    const io = socketIO(port);

    const motionService = new Service.MotionSensor(`Motion Sensor (${name})`);
    const occupancySensor = new Service.OccupancySensor(`Faces (${name})`);

    io.of('/vision').on('connection', (socket) => {
        console.log('vision connection established');
        motionService
            .setCharacteristic(Characteristic.StatusActive, true);
        occupancySensor
            .setCharacteristic(Characteristic.StatusActive, true);

        let faceTimeout;
        let motionTimeout;

        socket.on('faces', (data) => {
            log.debug('faces');
            occupancySensor
                .setCharacteristic(Characteristic.OccupancyDetected, Characteristic.OccupancyDetected.OCCUPANCY_DETECTED);
            clearTimeout(faceTimeout);
            faceTimeout = setTimeout(() => {
                log.debug('no faces');
                occupancySensor
                    .setCharacteristic(Characteristic.OccupancyDetected, Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
            }, 3000);
        });

        socket.on('motion', (data) => {
            if (data.val > 3) {
                log.debug('motion', data)
                motionService
                    .setCharacteristic(Characteristic.MotionDetected, true);
                clearTimeout(motionTimeout);
                motionTimeout = setTimeout(() => {
                    log.debug('no motion', data)
                    motionService
                        .setCharacteristic(Characteristic.MotionDetected, false);
                }, 3000);
            }
        });

        socket.on('disconnect', () => {
            log.info('vision disconnected');
            motionService
                .setCharacteristic(Characteristic.StatusActive, false);
            occupancySensor
                .setCharacteristic(Characteristic.StatusActive, false);
        });
    });

    return [motionService, occupancySensor];
}

