
/**
 * Module dependencies.
 */

// if node
var io = require('socket.io-client')
// end

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
