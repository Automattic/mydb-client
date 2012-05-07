(function(){var global = this;function debug(){return debug};function require(p, parent){ var path = require.resolve(p) , mod = require.modules[path]; if (!mod) throw new Error('failed to require "' + p + '" from ' + parent); if (!mod.exports) { mod.exports = {}; mod.call(mod.exports, mod, mod.exports, require.relative(path), global); } return mod.exports;}require.modules = {};require.resolve = function(path){ var orig = path , reg = path + '.js' , index = path + '/index.js'; return require.modules[reg] && reg || require.modules[index] && index || orig;};require.register = function(path, fn){ require.modules[path] = fn;};require.relative = function(parent) { return function(p){ if ('debug' == p) return debug; if ('.' != p.charAt(0)) return require(p); var path = parent.split('/') , segs = p.split('/'); path.pop(); for (var i = 0; i < segs.length; i++) { var seg = segs[i]; if ('..' == seg) path.pop(); else if ('.' != seg) path.push(seg); } return require(path.join('/'), parent); };};require.register("document.js", function(module, exports, require, global){

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
  for (var i in mod) {
    if (mod.hasOwnProperty(i)) {
      if ('$' == i.charAt(0)) {
        for (var ii in mod[i]) {
          if (mod.hasOwnProperty(ii)) {
            this.ops.emit(i + ':' + ii, mod[i][ii]);
          }
        }
      }
    }
  }

  fiddle(mod, null, this.obj);
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

  return EventEmitter.prototype.on.call(op + ':' + key, fn);
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

  return EventEmitter.prototype.removeListener.call(op + ':' + key, fn);
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
 * @api private
 */

function toArray (obj) {
  var arr = [];

  for (var i = 0, l = obj.length; i < l; i++) {
    arr.push(obj[i]);
  }

  return arr;
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
    keyParts = keyParts instanceof Array ? keyParts : keyParts.split(".");
    values = [];
    index = 0;
  }

  var ct, i, j, kp, pt = target;


  for(i = index, n = keyParts.length; i < n; i++) {
    kp = keyParts[i];
    ct = pt[kp];

    if(kp == '$') {
      for(j = pt.length; j--;) {
        _findValues(keyParts, pt[j], create, i + 1, values);
      }
      return values;
    } else
    if(!ct) {
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
    var ov = target[field] || [];
    ov.push(value);
    target[field] = ov;
  },

  /**
   */

  $pushAll: function(target, field, value) {
    var ov = target[field] || [];

    for(var i = 0, n = value.length; i < n; i++) {
      ov.push(value[i]);
    }
    target[field] = ov;
  },

  /**
   */

  $addToSet: function(target, field, value) {
    var ov = target[field] || [],
    each = value.$each || [value];

    for(var i = 0, n = each.length; i < n; i++) {
      var item = each[i];
      if(deepIndexOf(ov, item) == -1) ov.push(item);
    }
  },


  /**
   */

  $pop: function(target, field, value) {
    var ov = target[field];
    if(!ov) return;
    if(value == -1) {
      ov.splice(0, 1);
    } else {
      ov.pop();
    }
  },

  /**
   */

  $pull: function(target, field, value) {
    var ov = target[field];
    if(!ov) return;
    var newArray = [],
    sifter = sift(value);


    target[field] = ov.filter(function(v) {
      return !sifter.test(v);
    });
  },

  /**
   */

  $pullAll: function(target, field, value) {

    var ov = target[field];
    if(!ov) return;

    target[field] = ov.filter(function(v) {
      return deepIndexOf(value, v) == -1;
    })
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

  return function(target) {
    for(key in modify) {
      var modifier = modifiers[key];
      if(!modifier) continue;
      var v = modify[key];

      for(var key2 in v) {

        var keyParts = key2.split('.'),
        targetKey = keyParts.pop();

        var targets = dref.get(target, keyParts);

        for(var i = targets.length; i--;) {
          modifier(targets[i], targetKey, v[key2]);
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

  return function(target) {
    var targets = target instanceof Array ? target : [target],
    modified = false;

    for(var i = targets.length; i--;) {
      var tg = targets[i];
      if(!sifter || sifter.test(tg)) {
        modify(tg);
        modified = true;
      }
    }

    return modified;
  }
}

/**
 */

var fiddle = module.exports = function(modifiers, filter, target) {

  var fdlr = fiddler(modifiers, filter);

  if(target) return fdlr(target);

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
      document.cookie += ' mydb=' + sid + ';';
      match = [null, sid];
    }
    this.sid = match[1];
  } else {
    this.sid = String(Math.random()).substr(3);
  }

  debug('initialized client for sid "%s"', this.sid);

  return bind(this.doc, this);
}

/**
 * Selects a document.
 *
 * @api private
 */

Manager.prototype.doc = function (name, fn) {
  debug('fetching db "%s"', name);
  if (!this.docs[name]) {
    var doc = new Document(this, name);
    this.docs[name] = doc;
    doc.on('payload', fn);
  }
  return this;
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

});mydb = require('mydb');
})();
