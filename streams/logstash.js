'use strict';

var bunyan = require('bunyan');
var net = require('net'),
    fs = require('fs'),
    os = require('os'),
    tls = require('tls'),
    util = require('util'),
    extend = util._extend,
    _ = require('lodash');

var ECONNREFUSED_REGEXP = /ECONNREFUSED/;

var levels = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal'
};

function LogstashStream(options) {
  options = options || {};

  this.name        = 'bunyan';
  this.level       = options.level || 'info';
  this.server      = options.server || os.hostname();
  this.host        = options.host || '127.0.0.1';
  this.port        = options.port || 9999;
  this.application = options.appName || process.title;
  this.pid         = options.pid || process.pid;
  this.tags        = options.tags || ['bunyan'];
  this.type        = options.type;

  this.client = null;

  // ssl
  this.ssl_enable          = options.ssl_enable || false;
  this.ssl_key             = options.ssl_key || '';
  this.ssl_cert            = options.ssl_cert || '';
  this.ca                  = options.ca || '';
  this.ssl_passphrase      = options.ssl_passphrase || '';

  // Connection state
  this.log_queue = [];
  this.connected = false;
  this.socket = null;
  this.retries = -1;
  this.max_connect_retries = ('number' === typeof options.max_connect_retries) ? options.max_connect_retries : 4;

  this.connect();
}

LogstashStream.prototype.write = function logstashWrite(entry) {
  var level, rec, msg;

  if (typeof(entry) === 'string') {
    entry = JSON.parse(entry);
  }

  rec = _.cloneDeep(entry);

  level = rec.level;

  if (levels.hasOwnProperty(level)) {
    level = levels[level];
  }

  msg = {
    '@timestamp': rec.time.toISOString(),
    'message':    rec.msg,
    'tags':       this.tags,
    'source':     this.server + '/' + this.application,
    'level':      level
  };

  if (typeof(this.type) === 'string') {
    msg.type = this.type;
  }

  delete rec.time;
  delete rec.msg;

  // Remove internal bunyan fields that won't mean anything outside of
  // a bunyan context.
  delete rec.v;
  delete rec.level;

  rec.pid = this.pid;

  this.send(JSON.stringify(extend({}, msg, rec), bunyan.safeCycles()));
};

LogstashStream.prototype.connect = function () {
  var tryReconnect = true;
  var options = {};
  var self = this;
  this.retries++;
  this.connecting = true;
  if (this.ssl_enable) {
    options = {
      key: this.ssl_key ? fs.readFileSync(this.ssl_key) : null,
      cert: this.ssl_cert ? fs.readFileSync(this.ssl_cert) : null,
      passphrase: this.ssl_passphrase ? this.ssl_passphrase : null,
      ca: this.ca ? (function (caList) {
        var caFilesList = [];

        caList.forEach(function (filePath) {
          caFilesList.push(fs.readFileSync(filePath));
        });

        return caFilesList;
      }(this.ca)) : null
    };
    this.socket = new tls.connect(this.port, this.host, options, function() {
      self.socket.setEncoding('UTF-8');
      self.announce();
      self.connecting = false;
    });
  } else {
    this.socket = new net.Socket();
  }

  this.socket.on('error', function (err) {
    self.connecting = false;
    self.connected = false;
    self.socket.destroy();
    self.socket = null;

    if (!ECONNREFUSED_REGEXP.test(err.message)) {
      tryReconnect = false;
    }
  });

  this.socket.on('timeout', function() {
    if (self.socket.readyState !== 'open') {
      self.socket.destroy();
    }
  });

  this.socket.on('connect', function () {
    self.retries = 0;
  });

  this.socket.on('close', function () {
    self.connected = false;

    if (self.max_connect_retries < 0 || self.retries < self.max_connect_retries) {
      if (!self.connecting) {
        setTimeout(function () {
          self.connect();
        }, 100);
      }
    } else {
      self.log_queue = [];
      self.silent = true;
    }
  });

  if (!this.ssl_enable) {
    this.socket.connect(self.port, self.host, function () {
      self.announce();
      self.connecting = false;
    });
  }
};

LogstashStream.prototype.announce = function () {
  var self = this;
  self.connected = true;
  self.flush();
};

LogstashStream.prototype.flush = function () {
  var self = this;

  for (var i = 0; i < self.log_queue.length; i++) {
    self.sendLog(self.log_queue[i].message);
  }
  self.log_queue.length = 0;
};

LogstashStream.prototype.sendLog = function (message) {
  this.socket.write(JSON.stringify(message) + '\n');
};

LogstashStream.prototype.send = function logstashSend(message) {
  var self = this;

  // send tcp logs
  if (!self.connected) {
    self.log_queue.push({
      message: message,
    });
  } else {
    self.sendLog(message);
  }
};

module.exports = LogstashStream;
