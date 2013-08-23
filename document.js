
/**
 * Module dependencies.
 */

var request = require('superagent');
var query = require('mongo-query');
var debug = require('debug')('mydb-client:document');
var clone, dot, type, Emitter;

try {
  dot = require('dot');
  type = require('type');
  clone = require('clone');
  Emitter = require('emitter');
} catch(e){
  dot = require('dot-component');
  type = require('type-component');
  clone = require('clone-component');
  Emitter = require('emitter-component');
}

/**
 * Module exports.
 */

module.exports = Document;

/**
 * Document constructor.
 *
 * @param {Manager} originating manager.
 * @api public
 */

function Document(manager){
  this.$_manager = manager;
  this.$_readyState = 'unloaded';
}

/**
 * Mixes in `Emitter`.
 */

Emitter(Document.prototype);

/**
 * Returns the manager instance.
 *
 * @return {Manager} mng this doc was created from
 * @api public
 */

Document.prototype.$manager = function(){
  return this.$_manager;
};

/**
 * Returns the subscription id.
 *
 * @return {String} subscription id
 * @api public
 */

Document.prototype.$sid = function(){
  return this.$_sid;
};

/**
 * Returns the resource url.
 *
 * @return {String} url
 * @api public
 */

Document.prototype.$url = function(){
  return this.$_url;
};

/**
 * Returns the readyState.
 *
 * @param {String} readyState if setting
 * @return {Document|String} `this` if setting, or state string
 * @api public
 */

Document.prototype.$readyState = function(s){
  if (s) {
    if (s != this.$_readyState) {
      debug('setting state %s', s);
      this.$_readyState = s;
      this.emit('$state', s);
      this.emit('$state:' + s);
    }
    return this;
  } else {
    return this.$_readyState;
  }
};

/**
 * Override `on`.
 *
 * @param {String} key, or regular event
 * @param {String} optional, operation (eg: `set`, `$push`, `push`)
 * @param {Function} callback
 * @api public
 */

Document.prototype.on = function(key, op, fn){
  if ('string' == type(op)) {
    key = key + '$' + op.replace(/^\$/, '');
    op = fn;
  }
  return Emitter.prototype.on.call(this, key, op);
};

/**
 * Override `once`.
 *
 * @param {String} key, or regular event
 * @param {String} optional, operation (eg: `set`, `$push`, `push`)
 * @param {Function} callback
 * @api public
 */

Document.prototype.once = function(key, op, fn){
  if ('string' == type(op)) {
    key = key + '$' + op.replace(/^\$/, '');
    op = fn;
  }
  return Emitter.prototype.once.call(this, key, op);
};

/**
 * Override `off`.
 *
 * @param {String} key, or regular event
 * @param {String} optional, operation (eg: `set`, `$push`, `push`)
 * @param {Function} callback
 * @api public
 */

Document.prototype.off =
Document.prototype.removeListener = function(key, op, fn){
  if ('string' == type(op)) {
    key = key + '$' + op.replace(/^\$/, '');
    op = fn;
  }
  return Emitter.prototype.off.call(this, key, op);
};

/**
 * Override `listeners`.
 *
 * @param {String} key, or regular event
 * @param {String} optional, operation (eg: `set`, `$push`, `push`)
 * @api public
 */

Document.prototype.listeners = function(key, op){
  if (op) key = key + '$' + op.replace(/^\$/, '');
  return Emitter.prototype.listeners.call(this, key);
};

/**
 * Override `hasListeners`.
 *
 * @param {String} key, or regular event
 * @param {String} optional, operation (eg: `set`, `$push`, `push`)
 * @api public
 */

Document.prototype.hasListeners = function(key, op){
  if (op) key = key + '$' + op.replace(/^\$/, '');
  return Emitter.prototype.hasListeners.call(this, key);
};

/**
 * Payloads listener.
 *
 * @param {Object} doc payload
 * @api private
 */

Document.prototype.$onPayload = function(obj){
  debug('loading payload %j', obj);
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      this[i] = obj[i];
    }
  }

  // allow for buffered ops to be applied
  var self = this;
  setTimeout(function(){
    self.$readyState('loaded');
    self.emit('ready');
  }, 0);
};

/**
 * Operations listener.
 *
 * @param {Array} operation data `[query, op]`
 * @api private
 */

Document.prototype.$op = function(data){
  debug('got operation %j', data);
  var log = query(this, data[0], data[1], { strict: false });

  for (var i = 0; i < log.length; i++) {
    var ii;
    var obj = log[i];
    var val = obj.value;
    var key = obj.key;
    var type = obj.op;

    // express $addToSet as a $push
    if ('$addToSet' == type) {
      this.emit(key + '$push', val, obj);
    }

    // express $pop as a $pull
    if ('$pop' == type) {
      this.emit(key + '$pull', val, obj);
    }

    // express $rename as $unset + $set
    if ('$rename' == type) {
      this.emit(key + '$unset', null, obj);
      this.emit(val, this.get(val), obj);
      this.emit(val + '$set', this.get(val), obj);
    }

    // express $pushAll/$pullAll/$pull as multiple single ops
    if ('$pull' == type || /All/.test(type)) {
      for (ii = 0; ii < val.length; ii++) {
        this.emit(key + type.replace(/All/, ''), val[ii], obj);
      }
    } else {
      this.emit(key + type, val, obj);
    }

    var keys = key.split('.');
    for (ii = 0; ii < keys.length; ii++) {
      key = keys.slice(0, ii + 1).join('.');
      this.emit(key, this.get(key), obj);
    }
    this.emit('op', obj);
  }
};

/**
 * Called when the document is ready.
 *
 * @param {Function} callback
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.ready = function(fn){
  // make sure we dont fire `fn` if one of the `ready`
  // handlers triggered an `unloading` state by wrapping
  // each callback
  var self = this;
  function done(){
    if ('loaded' == self.$readyState()) fn();
  }

  if ('loaded' == this.$readyState()) {
    debug('ready() fired - doc ready');
    setTimeout(done, 0);
  } else {
    debug('ready() defered until doc is loaded');
    this.once('ready', done);
  }
  return this;
};

/**
 * Connects to the given url.
 *
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.load = function(url, fn){
  var manager = this.$manager();
  var socket = manager.socket;
  var self = this;

  if (manager.id) {
    load();
  } else {
    debug('will wait for manager socket id');
    this.$connectLoad = load;
    manager.once('id', load);
  }

  function load(){
    // cleanup
    delete self.$connectLoad;

    // perform cleanup
    if ('loading' == self.$readyState()) {
      self.destroy();
    }

    // mark ready state as loading the doc
    self.$readyState('loading');

    // decide whether to make a request
    var preloaded = manager.preloaded[url];
    if (preloaded) {
      debug('using preloaded document for url %s', url);
      self.$_url = url;
      self.$_sid = preloaded.sid;
      self.$onPayload(preloaded.doc);
      self.$readyState('loaded');
      manager.subscribe(self);
      delete manager.preloaded[url];
      if (fn) setTimeout(function(){ fn(null); }, 0);
      return;
    } else {
      debug('loading %s with headers %j', url, manager.headers);
    }

    // if in node, try to prefix the url if relative
    if ('undefined' != typeof process && '/' == url[0]) {
      url = (socket.secure ? 'https' : 'http') + '://' +
        socket.hostname + ':' + socket.port + url;
    }

    // keep track of current url
    self.$_url = url;
    url = url + (~url.indexOf('?') ? '' : '?') + '&mydb=1';
    url = url.replace('?&', '?');

    // get the subscription id over REST
    var xhr = request.get(url);
    if ('function' == typeof xhr.agent) {
      xhr.agent(this.agent);
    }
    xhr.set(manager.headers);

    // include socket id
    xhr.set('X-MyDB-SocketId', manager.id);

    // if we already have a document for this url
    // include the id to potentially leverage our cache
    var cached = manager.cache[self.$_url];
    if (cached) {
      xhr.set('X-MyDB-Id', cached.$id);
    }

    xhr.end(function(err, res){
      // XXX: remove this check when superagent gets `abort`
      if (xhr == self.$xhr) {
        if (err instanceof Error) {
          debug('socket error %s', err.stack);
          return fn && fn(err);
        } else if (!res) {
          // browser superagent doesn't support err, res
          res = err;
          err = null;
        }

        if (err) return fn && fn(err);

        if (res.ok) {
          if (fn) self.ready(function(){ fn(null); });
          self.$onresponse(res);
        } else {
          debug('subscription error %d', res.status);
          if (fn) {
            err = new Error('Subscription error: ' + res.status);
            err.url = url;
            err.status = res.status;
            fn(err);
          }
        }
      } else {
        debug('ignoring outdated resource subscription %s',
          res ? res.text : (err ? err.stack : ''));
      }
    });

    self.$xhr = xhr;
  }

  return this;
};

/**
 * Subscribe to a given `sid`.
 *
 * @param {Response} response
 * @api public
 */

Document.prototype.$onresponse = function(res){
  var sid = res.header['x-mydb-id'];
  var mng = this.$manager();

  debug('got subscription id "%s"', sid);

  this.$_sid = sid;

  if (200 == res.status) {
    debug('got payload with response');

    if (mng.subscriptions[sid]) {
      debug('applying cached payload');
      this.$onPayload(mng.subscriptions[sid][0].$clone());
    } else {
      debug('applying response payload');
      this.$onPayload(res.body);
    }
  } else if (304 == res.status) {
    debug('got 304 - payload already cached');
    this.$onPayload(mng.cache[this.$_url].$clone());
  } else {
    throw new Error('Unhandled status %d', res.status);
  }

  mng.subscribe(this);
};

/**
 * Gets the given key.
 *
 * @param {String} key
 * @param {Function} optional, if supplied wraps with `ready`
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.get = function(key, fn){
  var obj = this;

  function get(){
    return dot.get(obj, key);
  }

  if (fn) {
    this.ready(function(){
      fn(get());
    });
  } else {
    return get();
  }

  return this;
};

/**
 * Calls with the initial value + subsequent ones.
 *
 * @param {String} key
 * @param {Function} callback
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.upon = function(key, fn){
  this.get(key, function(v){
    fn(v, true);
  });
  this.on(key, function(v){
    fn(v, false);
  });
  return this;
};

/**
 * Loops through the given key.
 *
 * @param {String} key
 * @param {Function} callback
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.each = function(key, fn){
  var self = this;
  this.get(key, function(v){
    if ('array' == type(v)) v.forEach(fn);
    self.on(key, 'push', fn);
  });
  return this;
};

/**
 * Cleans up event listeners and data.
 *
 * @api private
 */

Document.prototype.$cleanup = function(){
  debug('cleaning up');

  if (this.$xhr) {
    if ('undefined' != typeof window) {
      try {
        debug('aborting xhr');
        this.$xhr.abort();
      } catch(e){}
    }
    this.$xhr = null;
  }

  this.$_sid = null;
  this.$_url = null;

  // cleanup existing state
  for (var i in this) {
    if ('_callbacks' == i) continue;
    if ('$' == i.charAt(0)) continue;
    if (!this.hasOwnProperty(i)) continue;
    if ('function' == typeof this[i]) continue;
    delete this[i];
  }
};

/**
 * Clones a document.
 *
 * @return {Object} cloned doc
 * @api private
 */

Document.prototype.$clone = function(){
  var obj = {};
  for (var i in this) {
    if ('_callbacks' == i) continue;
    if ('$' == i.charAt(0)) continue;
    if (!this.hasOwnProperty(i)) continue;
    if ('function' == typeof this[i]) continue;
    obj[i] = this[i];
  }
  return clone(obj);
};

/**
 * Destroys the subscription (if any)
 *
 * @param {Function} optional, callback
 * @return {Document} for chaining
 * @api public
 */

Document.prototype.destroy = function(fn){
  var sid = this.$sid();

  // clear callbacks prior to destroy
  this._callbacks = {};

  // clean up
  this.$cleanup();

  // remove payload / ops event listeners
  var manager = this.$manager();
  manager.off('op', this.$onOp);

  // clean up pending `load`
  if (this.$connectLoad) {
    manager.off('id', this.$connectLoad);
    delete this.$connectLoad;
  }

  // get current ready state
  var state = this.$readyState();

  function onunsubscribe(){
    if ('unloading' == self.$readyState()) {
      self.$readyState('unloaded');
    }
    if (fn) fn(null);
  }

  // unsubscribe if we have a sid
  if (sid) {
    manager.unsubscribe(this, sid);
 
    // get sid before cleanup
    this.$_unloading = sid;

    // mark ready state
    this.$readyState('unloading');

    // unsubscribe
    var self = this;
    if (manager.connected) {
      manager.on('unsubscribe', function unsubscribe(s){
        if (s == self.$_unloading) {
          debug('unsubscription "%s" complete', s);
          manager.off('unsubscribe', unsubscribe);
          onunsubscribe();
        }
      });
    } else {
      setTimeout(onunsubscribe, 0);
    }
  } else {
    if (state == 'unloaded') {
      debug('destroying in unloaded state');
      if (fn) {
        setTimeout(function(){
          fn(null);
        }, 0);
      }
    }
  }

  return this;
};
