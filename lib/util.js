
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
