
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
