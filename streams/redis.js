'use strict';

var instances = {};
var _ = require('lodash');
var Redis = require('ioredis');
var bunyan = require('bunyan');
var debug = require('debug')('arklogger');

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

    var port = cfg.port || 6379;
    var host = cfg.host || '127.0.0.1';
    var db = cfg.db || 0;

    // make it a single connection per redis
    var id = [port, host, db].join(':');
    if (instances[id]) {
      return instances[id];
    }
    instances[id] = this;

    this.key = cfg.key || 'logstash';
    this.pubsub = !!cfg.pubsub;

    // accepts existing redis client instance
    var redis = this.redis = cfg.redis || new Redis(port, host, {
        enableReadyCheck: false,
        enableOfflineQueue: true,
        lazyConnect: true,
        db: db,
        retryStrategy: function (times) {
            if (times > 10 && redis.offlineQueue.length > 500) {
                redis.offlineQueue.shift();
            }

            var delay = Math.min(times * 2, 2000);
            return delay;
        }
    });

    this.redis.connect().catch(function () {
        debug('[arklogger startup] Error connecting to redis');
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
