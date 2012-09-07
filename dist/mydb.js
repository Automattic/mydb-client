(function(){var global = this;function debug(){return debug};function require(p, parent){ var path = require.resolve(p) , mod = require.modules[path]; if (!mod) throw new Error('failed to require "' + p + '" from ' + parent); if (!mod.exports) { mod.exports = {}; mod.call(mod.exports, mod, mod.exports, require.relative(path), global); } return mod.exports;}require.modules = {};require.resolve = function(path){ var orig = path , reg = path + '.js' , index = path + '/index.js'; return require.modules[reg] && reg || require.modules[index] && index || orig;};require.register = function(path, fn){ require.modules[path] = fn;};require.relative = function(parent) { return function(p){ if ('debug' == p) return debug; if ('.' != p.charAt(0)) return require(p); var path = parent.split('/') , segs = p.split('/'); path.pop(); for (var i = 0; i < segs.length; i++) { var seg = segs[i]; if ('..' == seg) path.pop(); else if ('.' != seg) path.push(seg); } return require(path.join('/'), parent); };};require.register("document.js", function(module, exports, require, global){

/**
 * Module dependencies.
 */

var util = require('./util')
  , fiddle = require('./fiddle')
  , dref = require('./fiddle/dref')
  , EventEmitter = require('./event-emitter')
  , debug = require('debug')('mydb-client');

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
  this.bound = {
    onPayload: util.bind(this.onPayload, this),
    onOp: util.bind(this.onOp, this)
  };
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
  // if the document is being re-loaded
  if (this.name) {
    // remove old subscriptions
    this.socket.removeListener(this.name + '#payload', this.bound.onPayload);
    this.socket.removeListener(this.name + '#op', this.bound.onOp);

    // clear old keys
    for (var i = 0; i < this.keys.length; i++) {
      delete this.keys[i];
    }
  }

  this.name = name;
  this.keys = [];
  this.socket.emit('db', this.manager.sid, name);
  this.socket.on(name + '#payload', this.bound.onPayload);
  this.socket.on(name + '#op', this.bound.onOp);
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
      this.keys.push(i);
      this[i] = obj[i];
    }
  }
  this.isReady = true;
  this.emit('payload');
};

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
          var arr = dref.get(this, key) || [];
          var len = arr.length;
          var m = { $addToSet: {} };

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
          var unsetOp = { $unset: {} };
          var setOp = { $set: {} };
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

  var name = op + ':' + key;
  var self = this;

  function on () {
    EventEmitter.prototype.removeListener.call(this, name, on);
    fn.apply(this, arguments);
  };

  on.listener = fn;
  EventEmitter.prototype.on.call(this, name, on);

  return this;
};

/**
 * Overrides listeners to allow operations.
 *
 * @api public
 */

Document.prototype.listeners = function(key, op){
  if (~events.indexOf(key)) {
    return EventEmitter.prototype.listeners.call(this, key);
  }

  if (null == op) {
    op = '$set';
  } else {
    op = '$' + op;
  }

  return EventEmitter.prototype.listeners.call(this, op + ':' + key);
};

/**
 * Overrides rmeovListener to allow operations.
 *
 * @api public
 */

Document.prototype.removeListener = function(key, op, fn){
  if (~events.indexOf(key)) {
    return EventEmitter.prototype.removeListener.call(this, key, op);
  }

  if ('function' == typeof op) {
    fn = op;
    op = '$set';
  } else {
    op = '$' + op;
  }

  return EventEmitter.prototype.removeListener.call(this, op + ':' + key, fn);
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
    fn(self.get(key), true);
    self.on(key, fn);
  });
};

});require.register("event-emitter.js", function(module, exports, require, global){

/**
 * Module exports.
 */

module.exports = EventEmitter;

/**
 * Event emitter constructor.
 *
 * @api public.
 */

function EventEmitter () {};

/**
 * Adds a listener
 *
 * @api public
 */

EventEmitter.prototype.on = function (name, fn) {
  if (!this.$events) {
    this.$events = {};
  }

  if (!this.$events[name]) {
    this.$events[name] = fn;
  } else if (isArray(this.$events[name])) {
    this.$events[name].push(fn);
  } else {
    this.$events[name] = [this.$events[name], fn];
  }

  return this;
};

EventEmitter.prototype.addListener = EventEmitter.prototype.on;

/**
 * Adds a volatile listener.
 *
 * @api public
 */

EventEmitter.prototype.once = function (name, fn) {
  var self = this;

  function on () {
    self.removeListener(name, on);
    fn.apply(this, arguments);
  };

  on.listener = fn;
  this.on(name, on);

  return this;
};

/**
 * Removes a listener.
 *
 * @api public
 */

EventEmitter.prototype.removeListener = function (name, fn) {
  if (this.$events && this.$events[name]) {
    var list = this.$events[name];

    if (isArray(list)) {
      var pos = -1;

      for (var i = 0, l = list.length; i < l; i++) {
        if (list[i] === fn || (list[i].listener && list[i].listener === fn)) {
          pos = i;
          break;
        }
      }

      if (pos < 0) {
        return this;
      }

      list.splice(pos, 1);

      if (!list.length) {
        delete this.$events[name];
      }
    } else if (list === fn || (list.listener && list.listener === fn)) {
      delete this.$events[name];
    }
  }

  return this;
};

/**
 * Removes all listeners for an event.
 *
 * @api public
 */

EventEmitter.prototype.removeAllListeners = function (name) {
  if (name === undefined) {
    this.$events = {};
    return this;
  }

  if (this.$events && this.$events[name]) {
    this.$events[name] = null;
  }

  return this;
};

/**
 * Gets all listeners for a certain event.
 *
 * @api publci
 */

EventEmitter.prototype.listeners = function (name) {
  if (!this.$events) {
    this.$events = {};
  }

  if (!this.$events[name]) {
    this.$events[name] = [];
  }

  if (!isArray(this.$events[name])) {
    this.$events[name] = [this.$events[name]];
  }

  return this.$events[name];
};

/**
 * Emits an event.
 *
 * @api public
 */

EventEmitter.prototype.emit = function (name) {
  if (!this.$events) {
    return false;
  }

  var handler = this.$events[name];

  if (!handler) {
    return false;
  }

  var args = toArray(arguments).slice(1);

  if ('function' == typeof handler) {
    handler.apply(this, args);
  } else if (isArray(handler)) {
    var listeners = handler.slice();

    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
  } else {
    return false;
  }

  return true;
};

/**
 * Converts enumerable to Array.
 *
 * @param {Object} array-like object
 * @return {Array} array
 * @api private
 */

function toArray (obj) {
  var arr = [];

  for (var i = 0, l = obj.length; i < l; i++) {
    arr.push(obj[i]);
  }

  return arr;
};

/**
 * Checks for Array type.
 *
 * @param {Object} object
 * @return {Boolean} whether the obj is an array
 * @api private
 */

var isArray = Array.isArray || function isArray (obj) {
  return '[object Array]' == Object.prototype.toString.call(obj);
};

});require.register("fiddle/clone.js", function(module, exports, require, global){

module.exports = clone;

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
*/
function clone(parent, circular) {
  if (typeof circular == 'undefined')
    circular = true;
  var i;
  if (circular) {
    var circularParent = {};
    var circularResolved = {};
    var circularReplace = [];
    function _clone(parent, context, child, cIndex) {
      // Deep clone all properties of parent into child
      if (typeof parent == 'object') {
        if (parent == null)
          return parent;
        // Check for circular references
        for(i in circularParent)
          if (circularParent[i] === parent) {
            // We found a circular reference
            circularReplace.push({'resolveTo': i, 'child': child, 'i': cIndex});
            return null; //Just return null for now...
            // we will resolve circular references later
          }

        // Add to list of all parent objects
        circularParent[context] = parent;
        // Now continue cloning...
        if (parent instanceof Array) {
          child = [];
          for(i in parent)
            child[i] = _clone(parent[i], context + '[' + i + ']', child, i);
        }
        else if (parent instanceof Date)
          child = new Date(parent.getTime());
        else if (parent instanceof RegExp)
          child = new RegExp(parent.source);
        else {
          child = {};

          // Also copy prototype over to new cloned object
          child.__proto__ = parent.__proto__;
          for(i in parent)
            child[i] = _clone(parent[i], context + '[' + i + ']', child, i);
        }

        // Add to list of all cloned objects
        circularResolved[context] = child;
      }
      else
        child = parent; //Just a simple shallow copy will do
      return child;
    }

    var cloned = _clone(parent, '*');

    // Now this object has been cloned. Let's check to see if there are any
    // circular references for it
    for(i in circularReplace) {
      var c = circularReplace[i];
      if (c && c.child && c.i in c.child) {
        c.child[c.i] = circularResolved[c.resolveTo];
      }
    }
    return cloned;
  }
  else {
    // Deep clone all properties of parent into child
    var child;
    if (typeof parent == 'object') {
      if (parent == null)
        return parent;
      if (parent instanceof Array) {
        child = [];
        for(i in parent)
          child[i] = clone(parent[i], circular);
      }
      else if (parent instanceof Date)
        child = new Date(parent.getTime() );
      else if (parent instanceof RegExp)
        child = new RegExp(parent.source);
      else {
        child = {};
        child.__proto__ = parent.__proto__;
        for(i in parent)
          child[i] = clone(parent[i], circular);
      }
    }
    else
      child = parent; // Just a simple shallow clone will do
    return child;
  }
}

});require.register("fiddle/deep-equal.js", function(module, exports, require, global){
var pSlice = Array.prototype.slice;
var Object_keys = typeof Object.keys === 'function'
    ? Object.keys
    : function (obj) {
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    }
;

var deepEqual = module.exports = function (actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b);
  }
  try {
    var ka = Object_keys(a),
        kb = Object_keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

});require.register("fiddle/dref.js", function(module, exports, require, global){
/**
 * finds references
 */

var _findValues = function(keyParts, target, create, index, values) {

  if(!values) {
    keyParts = Array.isArray(keyParts) ? keyParts : keyParts.split(".");
    values = [];
    index = 0;
  }

  var ct, i, j, kp, pt = target;


  for(var i = index, n = keyParts.length; i < n; i++) {
    kp = keyParts[i];
    ct = pt[kp];

    if(kp == '$') {
      for(j = pt.length; j--;) {
        _findValues(keyParts, pt[j], create, i + 1, values);
      }
      return values;
    } else
    if(undefined === ct) {
      if(!create) return values;
      ct = target[kp] = {};
    }

    pt = ct;
  }

  if(ct) {
    values.push(ct);
  } else {
    values.push(pt);
  }

  return values;
}


/**
 */

var getValue = function(target, key) {
  var values =  _findValues(key, target);

  return key.indexOf('$') == -1 ? values[0] : values;
}

/**
 */

var setValue = function(target, key, newValue) {
  var keyParts = key.split("."),
  keySet = keyParts.pop();

  if(keySet == '$') {
    keySet = keyParts.pop();
  }

  var values = _findValues(keyParts, target, true);

  for(var i = values.length; i--;) {
    values[i][keySet] = newValue;
  }

}


exports.get = getValue;
exports.set = setValue;

});require.register("fiddle/index.js", function(module, exports, require, global){

var sift = require('./sift'),
clone    = require('./clone'),
equal    = require('./deep-equal'),
dref     = require('./dref');

/**
 */

var modifiers = {

  /**
   * iincrements field by N
   */

  $inc: function(target, field, value) {
    if(!target[field]) target[field] = 0;
    target[field] += value;
  },

  /**
   */

  $set: function(target, field, value) {
    target[field] = value;
  },

  /**
   */

  $unset: function(target, field) {
    delete target[field];
  },

  /**
   */

  $push: function(target, field, value) {
    var ov = target[field] || (target[field] = []);
    ov.push(value);
  },

  /**
   */

  $pushAll: function(target, field, value) {
    var ov = target[field] || (target[field] = []);

    for(var i = 0, n = value.length; i < n; i++) {
      ov.push(value[i]);
    }
  },

  /**
   */

  $addToSet: function(target, field, value) {
    var ov = target[field] || (target[field] = []),
    each = value.$each || [value];

    for(var i = 0, n = each.length; i < n; i++) {
      var item = each[i];
      if(deepIndexOf(ov, item) == -1) ov.push(item);
    }
  },


  /**
   */

  $pop: function(target, field, value, fn) {
    var ov = target[field];
    if (!Array.isArray(ov)) return false;
    if (!ov.length) return;
    var v;
    if(value == -1) {
      v = ov.shift();
    } else {
      v = ov.pop();
    }
    if (fn) {
      fn(v);
    }
  },

  /**
   */

  $pull: function(target, field, value, fn) {
    var ov = target[field];
    if (!Array.isArray(ov)) return false;
    if (!ov.length) return;
    var newArray = [],
    sifter = sift(value);


    var filteredCount = 0, v, filtered, index
    for (var i = 0, l = ov.length; i < l; i++) {
      index = i - filteredCount;
      v = ov[index];
      filtered = sifter.test(v);
      if (filtered) {
        ov.splice(index, 1);
        filteredCount++;
        if (fn) {
          fn(v);
        }
      }
    }
  },

  /**
   */

  $pullAll: function(target, field, value, fn) {

    var ov = target[field];
    if (!Array.isArray(ov)) return false;
    if (!ov.length) return;

    var filteredCount = 0, v, filtered, index;
    for (var i = 0, l = ov.length; i < l; i++) {
      index = i - filteredCount;
      v = ov[index];
      filtered = deepIndexOf(value, v) != -1;
      if (filtered) {
        ov.splice(index, 1);
        filteredCount++;
        if (fn) {
          fn(v);
        }
      }
    }
  },

  /**
   */

  $rename: function(target, field, value) {
    var ov = target[field];
    delete target[field];
    target[value] = ov;
  }
}

/**
 */

var deepIndexOf = function(target, value) {
  for(var i = target.length; i--;) {
    if(equal(target[i], value)) return i;
  }
  return -1;
}


/**
 */

var parse = function(modify) {

  var isModifier = false, key;
  for(key in modifiers) {
    if(key.substr(0,1) == '$') {
      isModifier = true;
      break;
    }
  }

  //replacing the object
  if(!isModifier) {

    return function(target) {
      for(key in target) {
        delete target[key];
      }

      var cloned = clone(modifiers);
      for(key in cloned) {
        target[key] = cloned[key];
      } 
    }
    
  }

  return function(target, fn) {
    for(key in modify) {
      var modifier = modifiers[key];
      if(!modifier) continue;
      var v = modify[key];

      for(var key2 in v) {

        var keyParts = key2.split('.'),
        targetKey = keyParts.pop();

        var targets = dref.get(target, keyParts);
        if (!Array.isArray(targets)) targets = [targets];

        for(var i = targets.length; i--;) {
          modifier(targets[i], targetKey, v[key2], fn);
        }
      }
    } 
  }
}

/**
 */

var fiddler = function(modifiers, filter) {

  var modify = parse(modifiers), sifter;
  if(filter) sifter = sift(filter);

  return function(target, fn) {
    var targets = target instanceof Array ? target : [target],
    modified = false;

    for(var i = targets.length; i--;) {
      var tg = targets[i];
      if(!sifter || sifter.test(tg)) {
        modify(tg, fn);
        modified = true;
      }
    }

    return modified;
  }
}

/**
 */

var fiddle = module.exports = function(modifiers, filter, target, fn) {

  var fdlr = fiddler(modifiers, filter);

  if(target) return fdlr(target, fn);

  return fdlr;
}

});require.register("fiddle/sift.js", function(module, exports, require, global){
/*
 * Sift
 * 
 * Copryright 2011, Craig Condon
 * Licensed under MIT
 *
 * Inspired by mongodb's query language 
 */


(function() {


  

  var _queryParser = new (function() {

    /**
     * tests against data
     */

    var test = this.test = function(statement, data) {

      var exprs = statement.exprs;


      //generally, expressions are ordered from least efficient, to most efficient.
      for(var i = 0, n = exprs.length; i < n; i++) {

        var expr = exprs[i];


        if(!expr.e(expr.v, _comparable(data), data)) return false;

      }

      return true;
    }


    /**
     * parses a statement into something evaluable
     */

    var parse = this.parse = function(statement, key) {

      var testers = [];
        
      if(statement)
      //if the statement is an object, then we're looking at something like: { key: match }
      if(statement.constructor == Object) {

        for(var k in statement) {

          //find the apropriate operator. If one doesn't exist, then it's a property, which means
          //we create a new statement (traversing) 
          var operator = !!_testers[k] ?  k : '$trav',

          //value of given statement (the match)
          value = statement[k],

          //default = match
          exprValue = value;

          //if we're working with a traversable operator, then set the expr value
          if(TRAV_OP[operator]) {
            
            //*if* the value is an array, then we're dealing with something like: $or, $and
            if(value instanceof Array) {
              
              exprValue = [];

              for(var i = value.length; i--;) {

                exprValue.push(parse(value[i]));
                  
              }

            //otherwise we're dealing with $trav
            } else {
              
              exprValue = parse(statement[k], k);

            }
          } 
          

          testers.push(_getExpr(operator, k, exprValue));

        }
                

      //otherwise we're comparing a particular value, so set to eq
      } else {

        testers.push(_getExpr('$eq', k, statement));

      }

      var stmt =  { 

        exprs: testers,
        k: key,
        test: function(value) {
          
          return test(stmt, value);

        } 

      };
      
      return stmt;
    
    }


    //traversable statements
    var TRAV_OP = {

      $and: true,
      $or: true,
      $nor: true,
      $trav: true,
      $not: true

    }


    function _comparable(value) {

      if(value instanceof Date) {

        return value.getTime();
      
      } else {

        return value;
      
      }
    }


    var _testers = {

      /**
       */

      $eq: function(a, b) {

        return a.test(b);

      },

      /**
       */

      $ne: function(a, b) {

        return !a.test(b);

      },

      /**
       */

      $lt: function(a, b) {

        return a > b;

      },

      /**
       */

      $gt: function(a, b) {

        return a < b;

      },

      /**
       */

      $lte: function(a, b) {

        return a >= b;

      },

      /**
       */

      $gte: function(a, b) {

        return a <= b;

      },


      /**
       */

      $exists: function(a, b) {

        return a == !!b;

      },

      /**
       */

      $in: function(a, b) {

        //intersecting an array
        if(b instanceof Array) {

          for(var i = b.length; i--;) {

            if(a.indexOf(b[i]) > -1) return true;

          } 

        } else {

          return a.indexOf(b) > -1;

        }

      },

      /**
       */

      $not: function(a, b) {
        return !a.test(b);
      },

      /**
       */

      $type: function(a, b, org) {

        //instanceof doesn't work for strings / boolean. instanceof works with inheritance
        return org ? org instanceof a || org.constructor == a : false;

      },

      /**
       */


      $nin: function(a, b) {

        return !_testers.$in(a, b);

      },

      /**
       */

      $mod: function(a, b) {

        return b % a[0] == a[1];

      },

      /**
       */

      $all: function(a, b) {


        for(var i = a.length; i--;) {

          var v = a[i];

          if(b.indexOf(v) == -1) return false;

        }

        return true;

      },

      /**
       */

      $size: function(a, b) {

        return b ? a == b.length : false;

      },

      /**
       */

      $or: function(a, b) {

        var i = a.length, n = i;

        for(; i--;) {

          if(test(a[i], b)) {

            return true;

          }

        }

        return !n;

      },

      /**
       */

      $nor: function(a, b) {

        var i = a.length, n = i;

        for(; i--;) {

          if(!test(a[i], b)) {

            return true;

          }

        }

        return !n;

      },

      /**
       */

      $and: function(a, b) {

        for(var i = a.length; i--;) {

          if(!test(a[i], b)) {

            return false;

          }
        }

        return true;
      },

      /**
       */

      $trav: function(a, b) {

        if(b instanceof Array) {
          
          for(var i = b.length; i--;) {
            
            var subb = b[i];

            if(subb[a.k] && test(a, subb[a.k])) return true;

          }

          return false;
        }


        return b ? test(a, b[a.k]) : false;

      }
    }

    var _prepare = {
      
      /**
       */

      $eq: function(a) {
        
        var fn;

        if(a instanceof RegExp) {

          return a;

        } else if (a instanceof Function) {

          fn = a;

        } else {
          
          fn = function(b) {

            return a == b;
          }

        }

        return {

          test: fn

        }

      },
      
      /**
       */
        
       $ne: function(a) {
        return _prepare.$eq(a);
       }
    };



    var _getExpr = function(type, key, value) {

      var v = _comparable(value);

      return { 

        //type
        // t: type,

        //k key
        k: key, 

        //v value
        v: _prepare[type] ? _prepare[type](v) : v, 

        //e eval
        e: _testers[type] 
      };

    }


  })();

  var sifter = function(query) {

    //build the filter for the sifter
    var filter = _queryParser.parse( query );
      
    //the function used to sift through the given array
    var self = function(target) {
        
      var sifted = [];

      //I'll typically start from the end, but in this case we need to keep the order
      //of the array the same.
      for(var i = 0, n = target.length; i < n; i++) {

        if(filter.test( target[i] )) sifted.push(target[i]);

      }

      return sifted;
    }

    //set the test function incase the sifter isn't needed
    self.test   = filter.test;
    self.query  = query;

    return self;
  }


  //sifts a given array
  var sift = function(query, target) {


    var sft = sifter(query);

    //target given? sift through it and return the filtered result
    if(target) return sft(target);

    //otherwise return the sifter func
    return sft;

  }


  //node.js?
  if((typeof module != 'undefined') && (typeof module.exports != 'undefined')) {
    
    module.exports = sift;

  } else 

  //browser?
  if(typeof window != 'undefined') {
    
    window.sift = sift;

  }

})();

});require.register("manager.js", function(module, exports, require, global){
/**
 * Module dependencies.
 */





var Document = require('./document')
  , bind = require('./util').bind
  , debug = require('debug')('mydb-client')

/**
 * Module exports.
 */

module.exports = Manager;

/**
 * Doument manager interface
 *
 * @param {String|io.SocketNamespace} socket uri or socket obj
 * @api public
 */

function Manager (socket) {
  if (!(this instanceof Manager)) {
    return new Manager(socket);
  }

  if (!socket) {
    socket = '/mydb';
  }

  if ('string' == typeof socket) {
    socket = io.connect(socket);
  }

  this.socket = socket;
  this.docs = {};

  // sid
  if ('undefined' != typeof document) {
    var match = document.cookie.match(/mydb=([^;]+)/);
    if (!match) {
      var sid = String(Math.random()).substr(3) + String(Math.random()).substr(3);
      document.cookie = 'mydb=' + sid + ';';
      match = [null, sid];
    }
    this.sid = match[1];
  } else {
    this.sid = String(Math.random()).substr(3);
  }

  debug('initialized client for sid "%s"', this.sid);

  var fn = bind(this.doc, this);

  // cross-browser `fn.__proto__ = this` equivalent
  fn.doc = fn;
  for (var i in Manager.prototype) {
    if (Manager.prototype.hasOwnProperty(i) && !fn[i]) {
      fn[i] = bind(this[i], this);
    }
  }
  return fn;
}

/**
 * Selects a document.
 *
 * @return {Document}
 * @api public
 */

Manager.prototype.doc = function (name, fn) {
  var doc = new Document(this)
    , self = this

  doc.on('load', function (n) {
    debug('fetching db "%s"', name);
    self.docs[name] = doc;
    if (fn) doc.ready(fn);
  });

  if (name) {
    doc.load(name);
  }

  return doc;
};

});require.register("mydb.js", function(module, exports, require, global){

/**
 * Module exports.
 */

module.exports = require('./manager');

});require.register("util.js", function(module, exports, require, global){

/**
 * Binds a function.
 *
 * @param {Function} function
 * @param {Object} scope
 * @return {Function} bound function
 * @api public
 */

exports.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
}

/**
 * Inheritance helper.
 *
 * @param {Function} constructor
 * @param {Function} constructor it will inherit from
 * @api public
 */

exports.inherits = function (ctor, ctorB) {
  function a () {};
  a.prototype = ctorB.prototype;
  ctor.prototype = new a;
}

/**
 * Gets an array of object keys.
 *
 * @param {Object} object
 * @return {Array} keys
 * @api public
 */

exports.keys = Object.keys || function keys (obj) {
  var keys = [];
  for (var i in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, i)) {
      keys.push(i);
    }
  }
  return keys;
}

});if ("undefined" != typeof module) { module.exports = require('mydb'); } else { mydb = require('mydb'); }
})();
