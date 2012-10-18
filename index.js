
/**
 * Module dependencies.
 */

var Socket = require('engine.io-client').Socket
  , Document = require('./document')
  , debug = require('debug')('mydb-client')
  , type, json, clone, Emitter;

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
  this.socket = new Socket(url);
  this.socket.onopen = this.onOpen.bind(this);
  this.socket.onclose = this.onClose.bind(this);
  this.socket.onmessage = this.onMessage.bind(this);
  this.connected = false;
  this.subscriptions = {};
}

/**
 * Mixes in `Emitter`.
 */

Emitter(Manager.prototype);

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
    case 'p': // payload
      this.process(obj.d);
      this.emit('payload', sid, obj.d);
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
      }
    }
  }
};

/**
 * Subscribes to the given sid.
 *
 * @param {String} id
 * @api private
 */

Manager.prototype.subscribe = function(id, doc){
  // keep count of the number of references to this subscription
  this.subscriptions[id] = this.subscriptions[id] || [];
  this.subscriptions[id].push(doc);

  // we subscribe to the server upon the first one
  if (1 == this.subscriptions[id].length) {
    this.write({ e: 'subscribe', i: id });
    this.emit('subscription', doc);
  } else {
    doc.onPayload(id, clone(this.subscriptions[id][0].$payload()));
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
 * @param {String} subscription id
 * @api private
 */

Manager.prototype.unsubscribe = function(id){
  // check that the subscription exists
  if (!this.subscriptions[id].length) {
    throw new Error('Trying to destroy inexisting subscription: ' + id);
  }

  // we substract from the reference count
  this.subscriptions[id].shift();

  // if no references are left we unsubscribe from the server
  if (!this.subscriptions[id].length) {
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

  if (url) {
    if (this.connected) {
      load();
    } else {
      this.once('connect', load);
    }
  }

  function load(){
    doc.load(url, fn);
  }

  return doc;
};
