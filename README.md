
# mydb-client

  MyDB client component.

## Installation

```
$ component install LearnBoost/mydb-client
```

## Example

```js
var mydb = require('mydb')('mydb.host.com');
mydb.get('/woot/woot');
```

## API

### Manager([url|options])

  Connects to the [mydb-server](http://github.com/learnboost/mydb-server)
  listening on `url`.
  If a parameter is not supplied it will connect to `window.location`
  Alternatively, an engine.io client options object can be supplied.

### Manager#get(url)

  Creates a `Document` by subscribing to the supplied `url`.
  Supplying a `url` is optional, if a vanilla document is desired. See
  `Document#load` below.

### Document

  Each document represents a subscription to a given resource URL.

### Document#$manager()

  Returns the associated manager.

### Document#$sid()

  Returns the sebscription id.

### Document#$readyState()

  - `unloaded`: no subscription (default when no `url` was provided)
  - `loading`: loading a resource
  - `loaded`: resource is loaded
  - `unloading`: subscription is being destroyed

### Document#$url()

  Returns the `url` this document is loaded from / loading.

### Document#load(url[, fn])

  Loads a document from the given URL. If `fn` is supplied, it's passed
  to `ready`.

### Document#ready(fn)

  Calls the supplied `fn` when the resource is loaded. If the resource
  is already loaded, the function is fired on the next tick.

### Document#get(key[, fn])

  Returns the value of the given `key`, which can use [dot
  notation](http://github.com/learnboost/dot).
  It throws if the document is not loaded.
  If `fn` is supplied, `ready` is called first, and the value is passed
  to the callback.

### Document#on(key[, op], fn)

  Subscribes to changes for the given `key`.

  - If no operator is supplied, `fn` gets called upon _any operation_.
  - Operations that don't change the document are ignored by
    [mongo-query](http://github.com/learnboost/mongo-query).
  - If an operation is supplied as the second parameter, the
    first parameter of the event callback will be the `value` property
    of the `log` object. For example, if the operation is a `$push`, the
    value that's pushed is the first parameter.
  - Otherwise, the first parameter is always the new value of the given
    key (`after`). For example, if the operation is acting on an array,
    like pushing, pulling or popping, you will still get the reference
    to the entire array.
  - The second parameter of the event callback is always the `log` object
    returned by mongo-query.

### Document#upon(key, fn)

  Calls `ready`, then calls `fn` with the initial value of the given
  `key`, and subscribes to subsequent change events for `key`.

### Document#each(key, fn)

  Calls `ready`, then calls `fn` for each value of the array found under
  `key`.

### Document#destroy(fn)

  Destroys this subscription. `fn` gets called when the unsubscription
  for the current id is confirmed.
