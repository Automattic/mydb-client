
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

  $pop: function(target, field, value) {
    var ov = target[field];
    if(!ov || !ov.length) return;
    if(value == -1) {
      ov.splice(0, 1);
    } else {
      ov.pop();
    }
  },

  /**
   */

  $pull: function(target, field, value, fn) {
    var ov = target[field];
    if(null == ov || !ov.length) return;
    var newArray = [],
    sifter = sift(value);


    target[field] = ov.filter(function(v) {
      var filtered = sifter.test(v);
      if (filtered && fn) {
        fn(v);
      }
      return filtered;
    });
  },

  /**
   */

  $pullAll: function(target, field, value, fn) {

    var ov = target[field];
    if(null == ov || !ov.length) return;

    target[field] = ov.filter(function(v) {
      var filtered = deepIndexOf(value, v) == -1;
      if (filtered && fn) {
        fn(v);
      }
      return filtered;
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
