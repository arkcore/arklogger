Logger
==============
Framework logger for ark team purposes. Based on [bunyan](https://github.com/trentm/node-bunyan) library.

### Features:
- lightweight and flexible
- support logging to: console, file, logstash and any stream
- all [features](https://github.com/trentm/node-bunyan#features) of bunyan

### Warning:
If stream `logstash` is used with pubsub queue (`cfg.pubsub` set to `true`) - app will not exit correctly (socket is still open).
You should close socket manually (`logstashstream.redis.end()`): https://github.com/mranney/node_redis#clientend

### Usage:
#####First, load library in your app
```js
var Logger = require('logger');
```
#####Second, init logging function with one of this methods:
*1) Init by config*
```js
// all fields are optional except "name" and "level"
var cfg = {
    name: 'my app',
    console: {
        level: 'info',
        color: true,
        timestamp: 'HH:mm:ss '
    },
    logstash: {
        level: 'info',
        key: 'logstash',
        pubsub: false,
        host: '127.0.0.1',
        port: 6379,
        db: 0
    },
    file: {
        level: 'error',
        path: 'error.log'
    }
};
var log = new Logger(cfg);
log.error('i will appear only in file')
```

*2) Create streams by yourself*
```js
var logger = new Logger('my app');

logger.appendStream({
    stream: new Logger.stream.logstash(),
    type: 'raw',
    level: 'info'
});
logger.appendStream({
  stream: new Logger.stream.console(),
  type: 'raw',
  level: 'info'
});

// if no appendStream called - will be created logger to console only
var log = logger.createLogger();
log.info('hello')

```
*3) Pass streams on init in array*
```js
var log = new LoggerClass('my app', [{
  stream: process.stdout,
  level: 'info'
}]);
log.error('im usable');
```
*4) Load preset*
```js
// will load config from presets/dc-fremont.json
var log = new Logger('my app', 'dc-fremont');
log.error('im usable');
```

### What else:
Logger supports all bunyan features: passing custom fields, child logging, serializers, logging caugth JS expeptions and http responces, working with streams etc. Please visit bunyan documentation for more.
