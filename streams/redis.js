'use strict';

var _ = require('lodash');
var redis = require('redis');
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
    this.redis = cfg.redis || redis.createClient(cfg.port || 6379, cfg.host || '127.0.0.1', {
        no_ready_check: true,
        retry_max_delay: 5000
    });

    this.redis.on('error', _.noop); // mute error and keep retrying

    if (cfg.db) {
        this.redis.select(cfg.db, _.noop);
    }

    if (!cfg.pubsub) {
        this.redis.unref();
    }
}

Stream.prototype.write = function(item) {
    var data = JSON.stringify(mapFields(item));
    if (this.pubsub) {
        this.redis.publish(this.key, data);
    } else {
        this.redis.rpush(this.key, data);
    }
};

module.exports = Stream;
