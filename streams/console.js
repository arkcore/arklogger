'use strict';

var moment = require('moment');
var clc = require('cli-color');

function Stream(cfg) {
    cfg = cfg || {};
    this.color = cfg.color || true;
    this.timestamp = (typeof cfg.timestamp === 'undefined') ? 'HH:mm:ss ' : cfg.timestamp;
}

Stream.prototype.colorify = function(msg, level) {
    if (!this.color) {
        return msg;
    }
    switch (level) {
        case 50: // error
            return clc.red.bold(msg);
        case 40: // warn
            return clc.yellow(msg);
        case 30: // info
            return clc.blue(msg);
        default:
            return msg;
    }
};

Stream.prototype.timestampify = function(time) {
    if (!this.timestamp) {
        return time;
    }
    return moment(time).format(this.timestamp);
};

Stream.prototype.write = function(item) {
    console.log(this.timestampify(item.time) + this.colorify(item.name, item.level) + ':', item.msg);
};

module.exports = Stream;
