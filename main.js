
const utils = require('@iobroker/adapter-core');
const Decoder = require('./lib/decoder.js');
const Encoder = require('./lib/encoder.js');
const Listener = require('./lib/listener.js');
const Reader = require('./lib/reader.js');

class Hapcan extends utils.Adapter {
    /**
       * @param {Partial<ioBroker.AdapterOptions>} [options={}]
       */
    constructor(options) {
        super({
            ...options,
            name: 'hapcan'
        });

        this.decoder = new Decoder();
        this.encoder = new Encoder();
        this.listener = new Listener();
        this.reader = new Reader(this);

        this.listener.on('chunk', (chunk) => this.decoder.put(chunk));
        this.decoder.on('frame', (frameType, flags, node, group, data) => this.reader.readFrame(frameType, flags, node, group, data));
        this.encoder.on('frame', (data) => this.listener.write(data));

        this.decoder.on('logInfo', (msg) => this.log.info(msg));
        this.decoder.on('logWarn', (msg) => this.log.warn(msg));
        this.decoder.on('logError', (msg) => this.log.error(msg));
        this.encoder.on('logInfo', (msg) => this.log.info(msg));
        this.encoder.on('logWarn', (msg) => this.log.warn(msg));
        this.encoder.on('logError', (msg) => this.log.error(msg));
        this.listener.on('logInfo', (msg) => this.log.info(msg));
        this.listener.on('logWarn', (msg) => this.log.warn(msg));
        this.listener.on('logError', (msg) => this.log.error(msg));

        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        //this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    connect() {
        // HAPCAN:
        this.listener.connect('192.168.7.22', 1010);

        // Testing:
        //this.listener.connect('192.168.7.200', 22222);
    }

    /**
           * @param {string} id
           * @param {ioBroker.State | null | undefined} state
           */
    async updateState(id, state) {
        await this.getObjectAsync(id).then(async stateObject => {
            if (stateObject === undefined || stateObject == null) {
                this.log.warn(`Object ${id} NOT found. State change ignored.`);
                return;
            } else if (stateObject.type !== 'state') {
                this.log.warn(`Object ${id} is NOT the state object. State change ignored.`);
                return;
            }
            if (!stateObject.common.write) {
                this.log.warn(`State object ${id} is NOT writable. State change ignored.`);
                return;
            }
            if (state === undefined || state == null) {
                this.log.warn(`State of ${id} is empty. State change ignored.`);
                return;
            }
            // this.log.info(`State object ${id} found`);
            // this.log.info(`typeof result = ${typeof result}`);

            // ex: 'hapcan.0.01_03.leds.1_on'
            // Delete state & channel id
            const channelId = id.slice(0, id.lastIndexOf('.'));
            // this.log.info(channelId);
            await this.getObjectAsync(channelId).then(async channelObject => {
                if (channelObject === undefined || channelObject == null) {
                    this.log.warn(`Channel ${id} NOT found. State change ignored.`);
                    return;
                } else if (channelObject.type !== 'channel') {
                    this.log.warn(`Object ${id} is NOT the channel object. State change ignored.`);
                    return;
                }

                const deviceId = channelId.slice(0, channelId.lastIndexOf('.'));
                // this.log.info(deviceId);
                await this.getObjectAsync(deviceId).then(async deviceObject => {
                    if (deviceObject === undefined || deviceObject == null) {
                        this.log.warn(`Device ${id} NOT found. State change ignored.`);
                        return;
                    } else if (deviceObject.type !== 'device') {
                        this.log.warn(`Object ${id} is NOT the device object. State change ignored.`);
                        return;
                    }

                    await this.encoder.writeState(deviceObject, channelObject, stateObject, state);
                });
            });
        });
    }

    /**
       * Is called when databases are connected and adapter received configuration.
       */
    async onReady() {
        this.reader = new Reader(this);

        this.connect();
        this.subscribeStates('*');

        //this.objects = {};
        //this.devices = {};
        /*
                this.objects.getObjectView('system', 'channel', { startkey: this.namespace + '.', endkey: this.namespace + '.\u9999' }, (err, res) => {
                    if (res) {
                        for (let i = 0, l = res.rows.length; i < l; i++) {
                            this.objects[res.rows[i].id] = res.rows[i].value;
                        }
                        this.objects.getObjectView('system', 'state', { startkey: this.namespace + '.', endkey: this.namespace + '.\u9999' }, (err, res) => {
                            if (res) {
                                for (let i = 0, l = res.rows.length; i < l; i++) {
                                    this.objects[res.rows[i].id] = res.rows[i].value;
        
                                    if (this.objects[res.rows[i].id].native && this.objects[res.rows[i].id].native.rf_address) {
                                        this.devices[this.objects[res.rows[i].id].native.rf_address] = this.objects[res.rows[i].id];
                                    }
                                }
                            }
                            this.connect();
                            this.subscribeStates('*');
                        });
                    }
                });
        */

        // The adapters config (in the instance object everything under the attribute 'native') is accessible via
        // this.config:
        //this.log.info('config option1: ' + this.config.option1);
        //this.log.info('config option2: ' + this.config.option2);

        /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named 'testVariable'
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
        // await this.setObjectAsync('testVariable', {
        //     type: 'state',
        //     common: {
        //         name: 'testVariable',
        //         type: 'boolean',
        //         role: 'indicator',
        //         read: true,
        //         write: true,
        //     },
        //     native: {},
        // });

        // in this template all states changes inside the adapters namespace are subscribed
        //this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged 'ack'
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw ioboker: ' + result);

        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
    }

    /**
       * Is called when adapter shuts down - callback has to be called under any circumstances!
       * @param {() => void} callback
       */
    onUnload(callback) {
        try {
            this.log.info('cleaned everything up...');
            this.listener.unload();
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
       * Is called if a subscribed object changes
       * @param {string} id
       * @param {ioBroker.Object | null | undefined} obj
       */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            //this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            //this.log.info(`object ${id} deleted`);
        }
    }

    /**
       * Is called if a subscribed state changes
       * @param {string} id
       * @param {ioBroker.State | null | undefined} state
       */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            if (!state.ack) {
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.updateState(id, state);
            }
            //this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            //this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires 'common.message' property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
       * @param {Partial<ioBroker.AdapterOptions>} [options={}]
       */
    module.exports = (options) => new Hapcan(options);
} else {
    // otherwise start the instance directly
    new Hapcan();
}







//this.createDevice('Fake device');
/*
                const device = {
                    'rf_address': '06aebc',
                    'initialized': true,
                    'fromCmd': false,
                    'error': false,
                    'valid': true,
                    'mode': 'MANUAL',
                    'dst_active': true,
                    'gateway_known': true,
                    'panel_locked': false,
                    'link_error': true,
                    'battery_low': false,
                    'valve': 0,
                    'setpoint': 20,
                    'temp': 0
                };
*/
/*
                const deviceInfo = {
                    'device_type': 1,
                    'device_name': 'ThermostatSchlafzimmer',
                    'room_name': 'Schlafzimmer',
                    'room_id': 1
                };
*/
//const id = this.namespace + '.devices.contact_' + device.rf_address;
//const objs = [];
/*
                objs.push({
                    _id: id,
                    common: {
                        name: deviceInfo.device_name,
                        role: 'contact'
                    },
                    type: 'channel',
                    native: {
                        rf_address: device.rf_address,
                        device_type: deviceInfo.device_type

                    }
                });
                objs.push({
                    _id: id + '.initialized',
                    common: {
                        name: deviceInfo.device_name + ' initialized',
                        type: 'boolean',
                        role: 'indicator.initialized',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.error',
                    common: {
                        name: deviceInfo.device_name + ' error',
                        type: 'boolean',
                        role: 'indicator.error',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.invalid',
                    common: {
                        name: deviceInfo.device_name + ' invalid',
                        type: 'boolean',
                        role: 'indicator.invalid',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.link_error',
                    common: {
                        name: deviceInfo.device_name + ' link_error',
                        type: 'boolean',
                        role: 'indicator.link',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.battery_low',
                    common: {
                        name: deviceInfo.device_name + ' battery_low',
                        type: 'boolean',
                        role: 'indicator.battery',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.opened',
                    common: {
                        name: deviceInfo.device_name + ' is opened',
                        type: 'boolean',
                        role: 'state',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
*/
/*
         if (id) {
             if (deviceInfo.room_name) {
                 this.getForeignObject('enum.rooms.' + deviceInfo.room_name.replace(/\s|,/g, '_'), (err, obj) => {
                     if (!obj) {
                         obj = {
                             _id: 'enum.rooms.' + deviceInfo.room_name.replace(/\s|,/g, '_'),
                             common: {
                                 name: deviceInfo.room_name,
                                 desc: 'Extracted from MAX! Cube',
                                 members: []
                             },
                             type: 'enum',
                             native: {}
                         };
                     }
                     if (obj.common.members.indexOf(id) === -1) {
                         obj.common.members.push(id);
                         this.setForeignObject(obj._id, obj, (err, obj) => {
                             if (err) {
                                 this.log.error(err);
                             }
                             syncObjects(objs);
                             setStates(device);
                         });
                     } else {
                         syncObjects(objs);
                         setStates(device);
                     }
                 });
             } else {
                 syncObjects(objs);
                 setStates(device);
             }
    }
*/