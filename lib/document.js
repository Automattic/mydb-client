
/**
 * Module dependencies.
 */

var util = require('./util')
  , fiddle = require('./fiddle')
  , dref = require('./fiddle/dref')
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

  // convert addToSet to push if effective, otherwise emit noop
  if (mod.$addToSet) {
    var add = mod.$addToSet;
    delete mod.$addToSet;
    for (var key in add) {
      if (add.hasOwnProperty(key)) {
        if (add[key].$each) {
          debug('transforming $addToSet each into multiple operations');
          for (var i = 0, l = add[key].$each.length; i < l; i++) {
            var m = { $addToSet: {} };
            m.$addToSet[key] = add[key].$each[i];
            this.onOp(m, true);
          }
        } else {
          var arr = dref.get(this.obj, key) || []
            , len = arr.length
            , m = { $addToSet: {} }

          m.$addToSet[key] = add[key];

          debug('existing set "%s" has %d elements', key, len);

          try {
            fiddle(m, null, this.obj);
          } catch (e) {
            this.emit('error', e);
          }

          debug('len comparison', len, dref.get(this.obj, key).length);
          if (len != dref.get(this.obj, key).length) {
            debug('addToSet push');
            this.ops.emit('$push:' + key, add[key]);
          } else {
            debug('addToSet noop');
            this.emit('noop', m);
          }
        }
      }
    }
  }

  var self = this;

  // capture $pull and $pullAll
  ['$pull', '$pullAll'].forEach(function (op) {
    if (mod[op]) {
      for (var key in mod[op]) {
        if (mod[op].hasOwnProperty(key)) {
          (function (k) {
            var m = {};
            m[op] = {};
            m[op][key] = mod[op][key];
            fiddle(m, null, self.obj, function (v) {
              self.ops.emit(op + ':' + key, v);
            });
          })(key);
        }
      }
      delete mod[op];
    }
  });

  if (!util.keys(mod).length) {
    return debug('ignoring empty operation');
  }

  // emit doc `op` event
  this.emit('op', mod, implicit);

  // apply transformations
  fiddle(mod, null, this.obj);

  // emit ops events
  for (var i in mod) {
    if (mod.hasOwnProperty(i)) {
      if ('$' == i.charAt(0)) {
        for (var ii in mod[i]) {
          if (mod[i].hasOwnProperty(ii)) {
            self.ops.emit(i + ':' + ii, mod[i][ii]);
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
