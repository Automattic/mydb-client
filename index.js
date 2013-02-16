
/**
 * Module dependencies.
 */

var Socket = require('engine.io');
var Document = require('./document');
var debug = require('debug')('mydb-client');
var type, json, clone, Emitter;

try {
  type = require('type');
  json = require('json');
  clone = require('clone');
  Emitter = require('emitter');
} catch(e) {
  type = require('type-component');
  json = require('json-component');
  clone = require('clone-component');
  Emitter = require('emitter-component');
}

/**
 * Module exports.
 */

module.exports = Manager;

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
  this.headers = opts.headers || {};
  this.connected = false;
  this.subscriptions = {};

  if (opts.sid) {
    debug('connecting with socket id "%s"', opts.sid);
    if (!~url.indexOf('?')) url += '?';
    url += '&mydb_id=' + opts.sid;
    url = url.replace('?&', '?');

    // assign socket id
    this.id = opts.sid;
  }

  this.open(url);
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
    this.socket.close();
  }

  if (this.connected) {
    this.onClose();
  }

  this.socket = new Socket(url);
  this.socket.onopen = this.onOpen.bind(this);
  this.socket.onclose = this.onClose.bind(this);
  this.socket.onmessage = this.onMessage.bind(this);
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
  this.emit('connect');
};

/**
 * Called upon upon close.
 *
 * @api private
 */

Manager.prototype.onClose = function(){
  debug('mydb-client socket closed');
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

  if (!this.subscriptions[sid] && obj.d) {
    debug('ignoring data for inexisting subscription %s', sid);
    return;
  }

  switch (obj.e) {
    case 'i': // socket id
      debug('got id "%s"', obj.i);
      this.id = obj.i;
      break;

    case 'o': // operation
      this.process(obj.d[0]);
      this.process(obj.d[1]);
      this.emit('op', sid, obj.d);
      break;

    case 'u': // unsubscribe confirmation
      this.emit('unsubscribe', sid);
      break;
  }
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
  if (!this.cache[doc.$_url]) {
    this.cache[doc.$_url] = doc;
  }

  this.subscriptions[doc.$_sid] = this.subscriptions[doc.$_sid] || [];
  this.subscriptions[doc.$_sid].push(doc);
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
 * @param {String} subscription id
 * @api private
 */

Manager.prototype.unsubscribe = function(id, doc){
  var subs = this.subscriptions[id];

  // check that the subscription exists
  if (!subs.length) {
    throw new Error('Trying to destroy inexisting subscription: ' + id);
  }

  // we substract from the reference count
  subs.splice(subs.indexOf(doc), 1);

  // if no references are left we unsubscribe from the server
  if (!subs.length) {
    delete this.subscriptions[id];
    this.write({ e: 'unsubscribe', i: id });
    this.emit('destroy', id);
  }
};

/**
 * Retrieves a document.
 *
 * @return {Document}
 * @api public
 */

Manager.prototype.get = function(url, fn){
  var doc = new Document(this);
  if (url) doc.load(url, fn);
  return doc;
};
