
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
