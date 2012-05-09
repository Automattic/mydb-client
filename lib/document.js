
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
 * @param {Object} modifier(s) object
 * @param {Boolean} whether the operation is implicit
 * @api private
 */

Document.prototype.onOp = function (mod, implicit) {
  debug('got %soperation %j', implicit ? 'implicit ' : '', mod);

  // convert pushAll to many individual push operations
  if (mod.$pushAll) {
    var all = mod.$pushAll;
    delete mod.$pushAll;
    for (var key in all) {
      for (var i = 0, l = all[key].length; i < l; i++) {
        var newMod = { $push: {} };
        newMod.$push[key] = all[key][i];
        this.onOp(newMod, true);
      }
    }
  }

  // emit doc `op` event
  this.emit('op', mod);

  // apply transformations
  fiddle(mod, null, this.obj);

  // emit ops events
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
 * Overrides once to allow operations.
 *
 * @api public
 */

Operations.prototype.once = function (key, op, fn) {
  if ('function' == typeof op) {
    fn = op;
    op = '$set';
  } else {
    op = '$' + op;
  }

  var name = op + ':' + key
    , self = this;

  function on () {
    EventEmitter.prototype.removeListener.call(this, name, on);
    fn.apply(this, arguments);
  };

  on.listener = fn;
  EventEmitter.prototype.on.call(this, name, on);

  return this;
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
