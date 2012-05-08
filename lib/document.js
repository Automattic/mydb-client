
/**
 * Module dependencies.
 */

var util = require('./util')
  , fiddle = require('./fiddle')
  , EventEmitter = require('./event-emitter')
  , debug = require('debug')('mydb-client')

/**
 * Module exports.
 */

module.exports = Document;

/**
 * Database constructor
 *
 * @param {Manager} manager
 * @param {String} database route
 * @api private
 */

function Document (manager, name) {
  this.name = name;
  this.manager = manager;
  this.socket = manager.socket;
  this.socket.emit('db', manager.sid, name);
  this.socket.on('payload', util.bind(this.onPayload, this));
  this.socket.on('op', util.bind(this.onOp, this));
  this.ops = new Operations;
}

/**
 * Inherits from EventEmitter
 */

util.inherits(Document, EventEmitter);

/**
 * Handles the document payload.
 *
 * @api private
 */

Document.prototype.onPayload = function (obj) {
  debug('got payload %j', obj);
  this.obj = obj;
  this.emit('payload', this.obj, this.ops);
}

/**
 * Handles an operation.
 *
 * @api private
 */

Document.prototype.onOp = function (mod) {
  debug('got operation %j', mod);

  // apply transformations
  fiddle(mod, null, this.obj);

  for (var i in mod) {
    if (mod.hasOwnProperty(i)) {
      if ('$' == i.charAt(0)) {
        for (var ii in mod[i]) {
          if (mod[i].hasOwnProperty(ii)) {
            this.ops.emit(i + ':' + ii, mod[i][ii]);
          }
        }
      }
    }
  }
};

/**
 * Operations emitter.
 */

function Operations () {}

/**
 * Inherits from EventEmitter.
 */

Operations.prototype.__proto__ = EventEmitter.prototype;

/**
 * Overrides on to allow operations.
 *
 * @api public
 */

Operations.prototype.on = function (key, op, fn) {
  if ('function' == typeof op) {
    fn = op;
    op = '$set';
  } else {
    op = '$' + op;
  }

  return EventEmitter.prototype.on.call(this, op + ':' + key, fn);
};

/**
 * Overrides removeListener to allow operations.
 *
 * @api public
 */

Operations.prototype.removeListener = function (key, op, fn) {
  if ('function' == typeof op) {
    fn = op;
    op = '$set';
  } else {
    op = '$' + op;
  }

  return EventEmitter.prototype.removeListener.call(this, op + ':' + key, fn);
};
