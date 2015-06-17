'use strict';

var _ = require('lodash');
var Redis = require('ioredis');
var bunyan = require('bunyan');

var fieldMap = {
    'name': 'type',
    'msg': 'message',
    'time': '@timestamp'
};

function mapFields(obj) {
    var ret = {};
    obj = _.omit(obj, 'v');

    if (obj.level <= bunyan.INFO) {
        obj.level = 'info';
    } else if (obj.level <= bunyan.WARN) {
        obj.level = 'warn';
    } else {
        obj.level = 'error';
    }

    obj.time = obj.time.toISOString();

    _.forOwn(obj, function (value, key) {
        if (fieldMap[key]) {
            ret[fieldMap[key]] = value;
        } else {
            ret[key] = value;
        }
    });

    ret['@version'] = 1;
    return ret;
}

function Stream(cfg) {
    cfg = cfg || {};
    this.key = cfg.key || 'logstash';
    this.pubsub = !!cfg.pubsub;

    // accepts existing redis client instance
    this.redis = cfg.redis || new Redis(cfg.port || 6379, cfg.host || '127.0.0.1', {
        enableReadyCheck: false,
        enableOfflineQueue: false,
        lazyConnect: true,
        db: cfg.db || 0
    });

    this.redis.connect().catch(function () {
        console.error('Error connecting to redis');
    });

}

Stream.prototype.write = function(item) {
    var data = JSON.stringify(mapFields(item));
    if (this.pubsub) {
        this.redis.publish(this.key, data).catch(_.noop);
    } else {
        this.redis.rpush(this.key, data).catch(_.noop);
    }
};

module.exports = Stream;
