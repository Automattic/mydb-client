
3.4.7 / 2013-08-30
==================

 * package: bump `engine.io-client`

3.4.6 / 2013-08-30
==================

 * package: bump `engine.io-client`

3.4.5 / 2013-08-30
==================

 * package: bump `engine.io-client`

3.4.4 / 2013-08-30
==================

 * package: bump `engine.io-client`

3.4.3 / 2013-08-25
==================

 * package: bump `engine.io-client` to fix regression

3.4.2 / 2013-08-23
==================

 * package: bump `engine.io-client`

3.4.1 / 2013-08-23
==================

 * package: engine.io-client bump

3.4.0 / 2013-08-23
==================

 * accept an `agent` option
 * package: update "superagent" to v0.15.4

3.3.0 / 2013-08-23
==================

 * package: bump `engine.io-client` for `agent` support

3.2.7 / 2013-08-06
==================

  * index: ignore destroying inexisting subscriptions

3.2.6 / 2013-06-16
==================

  * index: improved onClose for reopening connection

3.2.5 / 2013-06-15
==================

  * index: introduce `connect_error` event

3.2.4 / 2013-06-15
==================

  * package: bump `engine.io-client` to `0.6.2`

3.2.3 / 2013-06-15
==================

  * index: clean up socket id upon disconnection

3.2.2 / 2013-05-28
==================

  * document: fixed uncaught exception caused by debug [tootallnate]

3.2.1 / 2013-05-11
==================

  * index: added instances introspection ability

3.2.0 / 2013-04-17
==================

  * document: `strict` false no longer needed with `findAndModify`

3.1.0 / 2013-04-15
==================

  * document: `destroy` works in absence of connection

3.0.4 / 2013-04-15
==================

  * index: dont delete id

3.0.3 / 2013-04-15
==================

  * index: fix bug with engine

3.0.2 / 2013-04-02
==================

  * document: make sure `ready` handler that `unloads` stops other `ready` callbacks

3.0.1 / 2013-04-02
==================

  * package: bumped `mongo-query` to `0.4.2`

3.0.0 / 2013-03-19
==================

  * document: make operations strict

2.2.6 / 2013-03-08
==================

  * document: emit root-level mutation events [TooTallNate]

2.2.5 / 2013-03-08
==================

  * document: fix pseudo next-tick

2.2.4 / 2013-03-04
==================

  * document: fix error handling?

2.2.3 / 2013-02-24
==================

  * index: more reliable op application

2.2.2 / 2013-02-24
==================

  * package: bump `mongo-query`

2.2.1 / 2013-02-24
==================

  * document: pass `false` when not initial

2.2.0 / 2013-02-23
==================

  * document: added back upon second `isInitial` bool

2.1.1 / 2013-02-21
==================

  * *: refactor preloading to work with vanilla documents

2.1.0 / 2013-02-21
==================

  * index: fix instrumentation for doc creation

2.0.6 / 2013-02-21
==================

  * index: added preloading support to `.get`
  * index: added `Manager#preload`

2.0.5 / 2013-02-20
==================

  * version bump

2.0.4 / 2013-02-20
==================

  * version bump

2.0.3 / 2013-02-20
==================

  * version bump

2.0.2 / 2013-02-20
==================

  * index: fix connection with existing socket id

2.0.1 / 2013-02-20
==================

  * document: use `res.header`

2.0.0 / 2013-02-19
==================

  * index: make unsubscribe more reliable
  * document: handle `unloaded` destroy
  * document: pass sid along to unsubscribe since it gets cleared
  * document: renamed `connectLoad`
  * document: don't clone/clear event listeners
  * document: re-use payloads from other objects that could be more up-to-date
  * document: make `connectLoad` not `clone`able
  * document: instrumentation
  * document: allow for `manager.subscribe` to emit buffered ops prior to `ready` event
  * index: added op buffering
  * document: cleanup
  * document: rename `onOp` to `op`
  * document: remove legacy `onOp`
  * document: typo
  * document: moar instrumentation
  * document: improved error handling
  * index: escape query string component
  * package: bumped superagent
  * document: improved instrumentation
  * document: removed obsolete `$payload` method
  * packge: bumped `superagent`
  * document: fix header retrieval
  * document: added instrumentation
  * index: emit `id` event
  * index: support for node/component
  * index: clear cache upon unsubscribe
  * index: initialize cache
  * index: have `subscribe` keep track of documents and maintain a url cache
  * index: added id handling
  * document: use new unsubscribe signature
  * document: fixed `clone` reference
  * doucment: added `$clone` and improved `$cleanup`
  * document: improved `onresponse` handler
  * document: added new `onresponse` method to handle 304s
  * document: include new mydb headers with request
  * document: remove old payload subscription
  * document: wait until the manager has an id instead of just when it connects
  * document: remove expensive key book keeping
  * document: prefix internal method with `$`
  * document: simplify/rename `onPayload`
  * document: removed legacy payload event
  * document: added `clone` dependency
  * document: remove ugly date
  * document: use `mydb` in url instead of `my`
  * index: append `mydb_id` to url
  * document: cautious xhr `abort`

1.3.3 / 2013-02-08
==================

  * package: bumped `engine.io-client` to `0.4.3`

1.3.2 / 2013-02-08
==================

  * package: bumped `engine.io-client`

1.3.1 / 2013-02-08
==================

  * index: beautiful require

1.3.0 / 2013-02-08
==================

  * package: bumped `engine.io-client`
  * document: added `$subscribe` method
  * document: better cleanup if destroy is called while connecting

1.2.4 / 2012-11-30
==================

  * document: always cleanup upon destroy
  * document: run abort only on browser
  * document: always `abort` xhrs

1.2.3 / 2012-11-30
==================

  * package: bump `superagent` to get `abort`

1.2.2 / 2012-11-30
==================

  * index: improve subscription re-using logic
  * document: improve destroy logic

1.2.1 / 2012-11-30
==================

  * document: improve unsubscribe logic

1.2.0 / 2012-11-28
==================

  * document: make `destroy` work for all states
  * document: introduce `cleanup` method to wipe state
  * load: make sure to `load` only when the socket connects
  * document: make sure `$state` events get called only upon change
  * index: moving defer logic to document and ignore `.load` with no url
  * document: allow for destroying in `loading` state

1.1.18 / 2012-11-28
===================

  * document: fix error handling for browser

1.1.17 / 2012-11-28
===================

  * document: error handling is bitch

1.1.16 / 2012-11-26
===================

  * document: added key-tracking (fixes #10)

1.1.15 / 2012-11-26
===================

  * document: fix order of `destroy` callback

1.1.14 / 2012-11-26
===================

  * document: fix `$pull`, `$pullAll` and `$pushAll` events

1.1.13 / 2012-11-23
===================

  * index: add `$oid` and `$date` casting for arrays

1.1.12 / 2012-11-19
===================

  * document: introduce `ready` event

1.1.11 / 2012-11-19
===================

  * document: set up event listeners on `load` to fix multiple subscriptions (fixes #11)

1.1.10 / 2012-10-25
===================

  * index: fix missing `clone`

1.1.9 / 2012-10-25
==================

  * index: fixed race condition [visionmedia]

1.1.8 / 2012-10-23
==================

  * package: bumped `engine.io-client`

1.1.7 / 2012-10-23
==================

  * package: bump `engine.io-client`

1.1.6 / 2012-10-19
==================

  * index: add reconnection

1.1.5 / 2012-10-19
==================

  * document: fix `$rename`

1.1.4 / 2012-10-18
==================

  * index: implement payload cloning
  * document: fix xhr aborting

1.1.3 / 2012-10-17
==================

  * document: fix `$addToSet` event

1.1.2 / 2012-10-17
==================

  * document: emit `push` events for `$addToSet`

1.1.1 / 2012-10-15
==================

  * document: added payload syncing

1.1.0 / 2012-10-15
==================

  * index: added `$oid`/`$date` processing
  * package: bumped `mongo-query`

1.0.8 / 2012-10-15
==================

  * package: bumped `mongo-query`

1.0.7 / 2012-10-15
==================

  * document: fix `Document#ready` once the doc is ready.

1.0.6 / 2012-10-14
==================

  * package: bump `engine.io-client`

1.0.5 / 2012-10-14
==================

  * package: bump `engine.io-client`

1.0.4 / 2012-10-14
==================

  * package: bump `mongo-query`

1.0.3 / 2012-10-14
==================

  * package: bumped `mongo-query`

1.0.2 / 2012-10-12
==================

  * package: bumped `mongo-query`

1.0.1 / 2012-10-11
==================

  * document: emit `op` event

1.0.0 / 2012-10-09
==================

  * Implemented new protocol.

0.6.9 / 2012-09-25
==================

  * Bumped version

0.6.8 / 2012-09-25
==================

  * document: ignore multiple payload socket events

0.6.7 / 2012-09-21
==================

  * document: added `Document#each`

0.6.6 / 2012-09-19
==================

  * document: fix typo

0.6.5 / 2012-09-19
==================

  * document: fix for `bson` and `null` values

0.6.4 / 2012-09-19
==================

  * document: added bson->json transformation fn

0.6.3 / 2012-09-18
==================

  * Bumped version


0.6.2 / 2012-09-18
==================

  * Bumped version

0.6.1 / 2012-09-17
==================

  * Bumped version

0.6.0 / 2012-09-17
==================

  * document: consider `query` in the sockets

0.5.6 / 2012-09-12
==================

  * Bumped version

0.5.5 / 2012-09-07
==================

  * document: fix keys cleanup

0.5.4 / 2012-09-07
==================

  * mydb-client: fixed re-loading documents

0.5.3 / 2012-08-31
==================

  * document: added `listeners` override with ops support

0.5.2 / 2012-08-31
==================

  * document: added `removeListener` override with ops support

0.5.1 / 2012-08-28
==================

  * manager: temporarily reverting cookie flags

0.5.0 / 2012-08-23
==================

  * dref: fix for falsy values
  * document: `upon` now calls with undefined value
  * document: style

0.4.12 / 2012-08-15
===================

  * document: allow dot-notation for `Document#upon`

0.4.11 / 2012-08-15
===================

  * document: change upon semantics again - great method name btw

0.4.10 / 2012-08-14
===================

  * Added Document#upon callback parameter "initial".

0.4.9 / 2012-08-14
==================

  * Bumped.

0.4.8 / 2012-08-02
==================

  * Bumped.

0.4.7 / 2012-07-26
==================

  * Bumped.

0.4.6 / 2012-07-22
==================

  * Bumped.

0.4.5 / 2012-07-22
==================

  * Bumped.

0.4.4 / 2012-07-17
==================

  * manager: fixed cookie setting

0.4.3 / 2012-06-27
==================

  * Forgot to build again.

0.4.2 / 2012-06-27
==================

  * Ensure Document#upon calls Document#ready first.

0.4.1 / 2012-06-27
==================

  * Build

0.4.0 / 2012-06-25
==================

  * Added Document#upon

0.3.0 / 2012-06-25
==================

  * Added Document#load

0.2.0 / 2012-06-21
==================

  * Added Document#ready.
  * Merged document and emitter.

0.1.1 / 2012-06-06
==================

  * Bumped version.

0.1.0 / 2012-06-06
==================

  * Initial release.
