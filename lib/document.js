
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
 * White-listed events.
 *
 * @api private
 */

var events = ['payload', 'op', 'error', 'noop', 'load'];

/**
 * Database constructor
 *
 * @param {Manager} manager
 * @param {String} database route
 * @api private
 */

function Document (manager, name) {
  this.manager = manager;
  this.socket = manager.socket;
  this.isReady = false;
  if (name) {
    this.load(name);
  }
};

/**
 * Inherits from EventEmitter
 */

util.inherits(Document, EventEmitter);

/**
 * Loads the given document route.
 *
 * @param {String} doc route name
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.load = function (name) {
  this.name = name;
  this.socket.emit('db', this.manager.sid, name);
  this.socket.on(name + '#payload', util.bind(this.onPayload, this));
  this.socket.on(name + '#op', util.bind(this.onOp, this));
  this.emit('load', name);
  return this;
};

/**
 * Handles the document payload.
 *
 * @api private
 */

Document.prototype.onPayload = function (obj) {
  debug('got payload %j', obj);
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      this[i] = obj[i];
    }
  }
  this.isReady = true;
  this.emit('payload');
}

/**
 * Gets a key.
 *
 * @return {Object} value
 * @api public
 */

Document.prototype.get = function (key) {
  return dref.get(this, key);
};

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
          var arr = dref.get(this, key) || []
            , len = arr.length
            , m = { $addToSet: {} }

          m.$addToSet[key] = add[key];

          debug('existing set "%s" has %d elements', key, len);

          try {
            fiddle(m, null, this);
          } catch (e) {
            this.emit('error', e);
          }

          debug('len comparison', len, dref.get(this, key).length);
          if (len != dref.get(this, key).length) {
            debug('addToSet push');
            this.emit('$push:' + key, add[key]);
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
            var ret = fiddle(m, null, self, function (v) {
              self.emit('$pull:' + key, v);
            });
            if (false === ret) {
              self.emit('error', new Error(key + ' is not an array'));
            }
          })(key);
        }
      }
      delete mod[op];
    }
  });

  // capture $pop and fire pull events
  if (mod.$pop) {
    for (var key in mod.$pop) {
      if (mod.$pop.hasOwnProperty(key)) {
        (function (k) {
          var m = { $pop: {} };
          m.$pop[key] = mod.$pop[key];
          var ret = fiddle(m, null, self, function (v) {
            if (undefined !== v) {
              self.emit('$pull:' + key, v);
            }
          });
          if (false === ret) {
            self.emit('error', new Error(key + ' is not an array'));
          }
        })(key);
      }
    }
    delete mod.$pop;
  }

  // rename as an $unset followed by a $set
  if (mod.$rename) {
    for (var key in mod.$rename) {
      if (mod.$rename.hasOwnProperty(key)) {
        (function (k) {
          var unsetOp = { $unset: {} }
            , setOp = { $set: {} }
          unsetOp.$unset[k] = 1;
          setOp.$set[mod.$rename[k]] = dref.get(self, k);
          self.onOp(unsetOp, true);
          self.onOp(setOp, true);
          self.emit('$rename:' + k, mod.$rename[k]);
        })(key);
      }
    }
    delete mod.$rename;
  }

  if (!util.keys(mod).length) {
    return debug('ignoring empty operation');
  }

  // emit doc `op` event
  this.emit('op', mod, implicit);

  // apply transformations
  fiddle(mod, null, this);

  // emit ops events
  for (var i in mod) {
    if (mod.hasOwnProperty(i)) {
      if ('$' == i.charAt(0)) {
        for (var ii in mod[i]) {
          if (mod[i].hasOwnProperty(ii)) {
            self.emit(i + ':' + ii, mod[i][ii]);
            if ('$set' != i) {
              self.emit('$set:' + ii, mod[i][ii]);
            }
          }
        }
      }
    }
  }
};

/**
 * Calls the supplied fn when the doc is ready. If the doc is ready, it's
 * called immediately.
 *
 * @param {Function} callback
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.ready = function (fn) {
  if (this.isReady) {
    fn();
  } else {
    this.once('payload', fn);
  }
  return this;
};

/**
 * Overrides on to allow operations.
 *
 * @api public
 */

Document.prototype.on = function (key, op, fn) {
  if (~events.indexOf(key)) {
    return EventEmitter.prototype.on.call(this, key, op);
  }

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

Document.prototype.once = function (key, op, fn) {
  if (~events.indexOf(key)) {
    return EventEmitter.prototype.once.call(this, key, op);
  }

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
 * Fires the callback when the given key is ready and upon changes.
 *
 * When called when the initial value, the second parameter of the
 * callback is `true`
 *
 * @param {String} key
 * @param {Function} callback
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.upon = function (key, fn) {
  var self = this;
  return this.ready(function () {
    if (null != self[key]) {
      fn(self[key], true);
    } else {
      self.once(key, fn);
    }
  });
};
