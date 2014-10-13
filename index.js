'use strict';

var bunyan = require('bunyan');
var Stream = require('./streams');
var _ = require('lodash-node');


function Logger(name, streams) {

    this.cfg = {
        name: name,
        streams: [],
        serializers: bunyan.stdSerializers
    };

    if (typeof name === 'object') {
        this.parseConfig(name);
        return this.createLogger();
    } else if (streams) {
        if (typeof streams === 'string') {
            this.loadPreset(name, streams);
        } else {
            this.cfg.streams = streams;
        }
        return this.createLogger();
    }
}

Logger.prototype.loadPreset = function (name, preset) {
    var config = require('./presets/' + preset + '.json');
    config.name = name;
    this.parseConfig(config);
};

Logger.prototype.parseConfig = function (config) {
    this.cfg = _.omit(this.cfg, 'name');

    for (var key in config) {
        var val = config[key];
        switch (key) {
        case 'name':
            this.cfg.name = val;
            break;
        case 'console':
            this.appendStream({
                stream: new Stream.console(val),
                type: 'raw',
                level: val.level
            });
            break;
        case 'logstash':
            this.appendStream({
                stream: new Stream.logstash(val),
                type: 'raw',
                level: val.level
            });
            break;
        case 'redis':
            this.appendStream({
                stream: new Stream.redis(val),
                type: 'raw',
                level: val.level
            });
            break;
        case 'file':
            this.appendStream(val);
            break;
        }
    }
};

Logger.prototype.appendStream = function (stream) {
    this.cfg.streams.push(stream);
};

Logger.prototype.createLogger = function () {
    if (this.log) {
        throw new Error('Logger already created');
    }
    if (!this.cfg.streams.length) {
        this.appendStream({
            stream: new Stream.console(),
            type: 'raw',
            level: 'info'
        });
    }
    this.log = bunyan.createLogger(this.cfg);
    this.log.on('error', function (err) {
        // this error will not show correct stack, but at least you got error
        throw new Error(err);
    });
    return this.log;
};

Logger.stream = Stream;

module.exports = Logger;
