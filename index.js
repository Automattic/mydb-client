
/**
 * Module dependencies.
 */

var Document = require('./document');
var debug = require('debug')('mydb-client');
var type, json, clone, Socket, Emitter;

try {
  type = require('type');
  json = require('json');
  clone = require('clone');
  Socket = require('engine.io');
  Emitter = require('emitter');
} catch(e) {
  type = require('type-component');
  json = require('json-component');
  clone = require('clone-component');
  Socket = require('engine.io-client');
  Emitter = require('emitter-component');
}

/**
 * Module exports.
 */

module.exports = Manager;

/**
 * Make `Manager` an emitter itself.
 */

Emitter(Manager);

/**
 * Expose instances.
 */

Manager.instances = [];

/**
 * Noop.
 */

function noop(){}

/**
 * Manager constructor.
 *
 * Options:
 *   - `headers` custom headers for the resource request
 *
 * @param {String|Object} optional, url to connect socket to or eio opts
 * @parma {Object} options
 * @api public
 */

function Manager(url, opts){
  if (!(this instanceof Manager)) return new Manager(url, opts);

  opts = opts || {};
  this.agent = opts.agent || false;
  this.headers = opts.headers || {};
  this.connected = false;
  this.subscriptions = {};
  this.bufferedOps = {};
  this.cache = {};
  this.preloaded = {};

  if (opts.sid) {
    // assign socket id
    this.id = opts.sid;
  }

  this.open(url);

  // keep track of the instance
  Manager.instances.push(this);
  Manager.emit('instance', this);
}

/**
 * Mixes in `Emitter`.
 */

Emitter(Manager.prototype);

/**
 * Called upon `open`.
 *
 * @param {String} url
 * @api private
 */

Manager.prototype.open =
Manager.prototype.reconnect = function(url){
  if (!url && this.url) url = this.url;

  if (this.socket) {
    this.socket.onopen = noop;
    this.socket.onclose = noop;
    this.socket.onmessage = noop;
    this.socket.onerror = noop;
    this.socket.close();
  }

  if (this.connected) {
    this.onClose();
  }

  var opts = {
    agent: this.agent
  };
  if (this.id) {
    debug('connecting with existing mydb_id %s', this.id);
    opts.query = { mydb_id: this.id };
  }

  this.socket = new Socket(url, opts);
  this.socket.onopen = this.onOpen.bind(this);
  this.socket.onclose = this.onClose.bind(this);
  this.socket.onmessage = this.onMessage.bind(this);
  this.socket.onerror = this.onError.bind(this);
  this.url = url;
};

/**
 * Called upon upon open.
 *
 * @api private
 */

Manager.prototype.onOpen = function(){
  debug('mydb-client socket open');
  this.connected = true;
  this.socket.onerror = noop;
  this.emit('connect');
};

/**
 * Called upon upon close.
 *
 * @api private
 */

Manager.prototype.onClose = function(){
  debug('mydb-client socket closed');
  this.id = null;
  this.subscriptions = {};
  this.bufferedOps = {};
  this.cache = {};
  this.preloaded = {};
  this.connected = false;
  this.emit('disconnect');
};

/**
 * Called when a message is received.
 *
 * @api private
 */

Manager.prototype.onMessage = function(msg){
  var obj = json.parse(msg);
  var sid = obj.i;

  function doOp(sub){
    // next tick to make sure the op handler doesn't alter
    // the subscriptions array
    setTimeout(function(){
      sub.$op(obj.d);
    }, 0);
  }

  switch (obj.e) {
    case 'i': // socket id
      debug('got id "%s"', obj.i);
      this.id = obj.i;
      this.emit('id', obj.i);
      break;

    case 'o': // operation
      this.process(obj.d[0]);
      this.process(obj.d[1]);

      if (this.subscriptions[sid]) {
        debug('got operations for subscription "%s"', sid);
        for (var i = 0, l = this.subscriptions[sid].length; i < l; i++) {
          doOp(this.subscriptions[sid][i]);
        }
      } else {
        debug('buffering operation for subscription "%s"', sid);
      }
      break;

    case 'u': // unsubscribe confirmation
      this.emit('unsubscribe', sid);
      break;
  }
};

/**
 * Handles socket errors.
 *
 * @api private
 */

Manager.prototype.onError = function(err){
  debug('connect error');
  this.socket.onopen = noop;
  this.socket.onerror = noop;
  this.emit('connect_error', err);
};

/**
 * Converts bson-json into JavaScript counterparts.
 * Eg: `$oid` > string, `$date` > Date
 *
 * @param {Object} obj
 * @api public
 */

Manager.prototype.process = function(obj){
  if ('object' != type(obj)) return;
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      var val = obj[i];
      if ('object' == type(val)) {
        if (val.$oid) {
          // $oid => string
          obj[i] = val.$oid;
        } else if (val.$date) {
          // $date => Date(ts)
          obj[i] = new Date(val.$date);
        } else {
          // recurse
          this.process(obj[i]);
        }
      } else if ('array' == type(val)) {
        for (var ii = 0; ii < val.length; ii++) {
          this.process(val[ii]);
        }
      }
    }
  }
};

/**
 * Subscribes to the given sid.
 *
 * @param {Document} doc
 * @api private
 */

Manager.prototype.subscribe = function(doc){
  var sid = doc.$_sid;
  var url = doc.$_url;
  debug('subscribing "%s" ("%s")', sid, url);

  // cache url
  this.cache[url] = doc;

  // track subscription
  this.subscriptions[sid] = this.subscriptions[sid] || [];
  this.subscriptions[sid].push(doc);

  // check for buffered ops
  var buffer = this.bufferedOps[sid];
  if (buffer) {
    debug('emitting buffered ops for "%s"', sid);
    for (var i = 0, l = buffer.length; i < l; i++) {
      doc.$op(buffer[i]);
    }
    delete this.bufferedOps[sid];
  }
};

/**
 * Writes the given object to the socket.
 *
 * @api private
 */

Manager.prototype.write = function(obj){
  this.socket.send(json.stringify(obj));
};

/**
 * Destroys a subscription.
 *
 * @param {Document} doc
 * @param {String} subscription id
 * @api private
 */

Manager.prototype.unsubscribe = function(doc, id){
  var subs = this.subscriptions[id];

  // check that the subscription exists
  if (!subs || !subs.length) {
    debug('ignore destroy of inexisting subscription "%s"', id);
    return;
  }

  // we substract from the reference count
  subs.splice(subs.indexOf(doc), 1);

  // if no references are left we unsubscribe from the server
  if (!subs.length) {
    debug('destroying subscription for "%s"', id);

    // clear cache
    delete this.cache[doc.$_url];

    // clear subscription
    delete this.subscriptions[id];

    // notify server
    this.write({ e: 'unsubscribe', i: id });
    this.emit('destroy', id);
  } else {
    debug('maintaining subscription for "%s" - %d docs left', id, subs.length);
  }
};

/**
 * Preloads a document.
 *
 * Options:
 *  - {String} url
 *  - {String} subscription id
 *  - {Object} document
 *
 * @param {Object} options
 * @api public
 */

Manager.prototype.preload = function(opts){
  debug('preloaded %s (%s): %j', opts.url, opts.sid, opts.doc);
  this.preloaded[opts.url] = opts;
};

/**
 * Retrieves a document.
 *
 * @return {Document}
 * @api public
 */

Manager.prototype.get = function(url, fn){
  var doc = new Document(this);
  if (url) {
    debug('creating new document for url %s', url);
    doc.load(url, fn);
  } else {
    debug('creating new vanilla document');
  }
  return doc;
};
