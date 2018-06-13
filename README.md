## Kite API

[![Build Status](https://travis-ci.org/kiteco/kite-api-js.svg?branch=master)](https://travis-ci.org/kiteco/kite-api-js) [![codecov](https://codecov.io/gh/kiteco/kite-api-js/branch/master/graph/badge.svg)](https://codecov.io/gh/kiteco/kite-api-js)

#### .STATES

An object containing the constant values of the various states of `kited`

|State|Value|Alias|
|---|---|---|
|UNSUPPORTED|`0`||
|UNINSTALLED|`1`||
|NOT_RUNNING|`2`|INSTALLED|
|NOT_REACHABLE|`3`|RUNNING|
|UNLOGGED|`4`|REACHABLE|
|NOT_WHITELISTED|`5`|AUTHENTICATED|
|WHITELISTED|`6`|&nbsp;|

#### .editorConfig

The `editorConfig` object is provided as a way for an editor to store information across instances and session. It can be setup with different concrete stores that implements the various solutions to store the data.

By default it is setup with a `MemoryStore` that just stores everything in memory (it thus won't persist across session nor instances).

The available stores are:
- `MemoryStore`: Used as a placeholder, it is also useful in tests.
- `FileStore`: Stores everything on a file at the path specified during creation
- `LocalStore`: When running in a browser environment this store allows you to use the `localStorage` as a way to store the config data. The store takes a `key` which will be used to access the data in the local storage object.

The object exposes two main functions, `get` and `set` that both returns a promise when invoked.

Storage is done using JSON format, and the `path` argument in both methods resolves to a real object in that JSON structure. However, stores implementation only have to deal with strings, the whole serialization/parsing is handled by the editor config object.

```js
KiteAPI.editorConfig.set('path.to.some.data', 'data')
.then(() => KiteAPI.editorConfig.get('path.to.some.data'))
.then(data => {
  console.log(data)
  // output: data
  // store data: { path: { to: { some: 'data' }} }
})
```

#### .toggleRequestDebug()

This function is both a proxy to the `KiteConnector` method of the same name as well as calling the corresponding function on the `Account` object.

#### .onDidDetectWhitelistedPath(listener)
#### .onDidDetectNonWhitelistedPath(listener)
#### .requestJSON(options, data, timeout)
#### .canAuthenticateUser()
#### .authenticateUser(email, password)
#### .authenticateSessionID(key)
#### .saveUserID()
#### .isPathWhitelisted(path)
#### .canWhitelistPath(path)
#### .whitelistPath(path)
#### .blacklistPath(path, noAction)
#### .getSupportedLanguages()
#### .getHoverDataAtPosition(filename, source, position, editor)
#### .getReportDataAtPosition(filename, source, position, editor)
#### .getSymbolReportDataForId(id)
#### .getValueReportDataForId(id)
#### .getMembersDataForId(id)
#### .getUsagesDataForValueId(id)
#### .getUsageDataForId(id)
#### .getExampleDataForId(id)
#### .getUserAccountInfo()
#### .isFileAuthorized(filename)
#### .shouldOfferWhitelist(filename)
#### .shouldNotify(filename)
#### .projectDirForFile(filename)
#### .getStatus(filename)
#### .getCompletionsAtPosition(filename, source, position, editor)
#### .getSignaturesAtPosition(filename, source, position, editor)
#### .getAutocorrectData(filename, source, editorMeta)
#### .getAutocorrectModelInfo(version, editorMeta)
#### .getOsName()
#### .postSaveValidationData(filename, source, editorMeta)
#### .postAutocorrectFeedbackData(response, feedback, editorMeta)
#### .postAutocorrectHashMismatchData(response, requestStartTime, editorMeta)
#### .sendFeatureMetric(name)
#### .featureRequested(name, editor)
#### .featureFulfilled(name, editor)
#### .featureApplied(name, editor)

#### .Account

##### .initClient(hostname, port)
##### .disposeClient()
##### .toggleRequestDebug()
##### .checkEmail(data)
##### .createAccount(data, callback)
##### .login(data, callback)
##### .resetPassword(data, callback)


#### Delegated methods

##### .arch()

A proxy to the [`KiteConnector.arch`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#arch) method.

##### .canInstallKite()

A proxy to the [`KiteConnector.canInstallKite`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#caninstallkite) method.

##### .canRunKite()

A proxy to the [`KiteConnector.canRunKite`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#canrunkite) method.

##### .canRunKiteEnterprise()

A proxy to the [`KiteConnector.canRunKiteEnterprise`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#canrunkiteenterprise). method

##### .checkHealth()

A proxy to the [`KiteConnector.checkHealth`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#checkhealth) method.

##### .downloadKite(url, options)

A proxy to the [`KiteConnector.downloadKite`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#downloadkiteurl-options) method.

##### .downloadKiteRelease(options)

A proxy to the [`KiteConnector.downloadKiteRelease`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#downloadkitereleaseoptions). method

##### .hasBothKiteInstalled()

A proxy to the [`KiteConnector.hasBothKiteInstalled`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#hasbothkiteinstalled). method

##### .hasManyKiteEnterpriseInstallation()

A proxy to the [`KiteConnector.hasManyKiteEnterpriseInstallation`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#hasmanykiteenterpriseinstallation) method.

##### .hasManyKiteInstallation()

A proxy to the [`KiteConnector.hasManyKiteInstallation`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#hasmanykiteinstallation) method.

##### .installKite(options)

A proxy to the [`KiteConnector.installKite`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#installkiteoptions) method.

##### .isAdmin()

A proxy to the [`KiteConnector.isAdmin`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#isadmin) method.

##### .isKiteEnterpriseInstalled()

A proxy to the [`KiteConnector.isKiteEnterpriseInstalled`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#iskiteenterpriseinstalled) method.

##### .isKiteEnterpriseRunning()

A proxy to the [`KiteConnector.isKiteEnterpriseRunning`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#iskiteenterpriserunning) method.

##### .isKiteInstalled()

A proxy to the [`KiteConnector.isKiteInstalled`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#iskiteinstalled) method.

##### .isKiteReachable()

A proxy to the [`KiteConnector.isKiteReachable`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#iskitereachable) method.

##### .isKiteRunning()

A proxy to the [`KiteConnector.isKiteRunning`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#iskiterunning) method.

##### .isKiteSupported()

A proxy to the [`KiteConnector.isKiteSupported`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#iskitesupported) method.

##### .isOSSupported()

A proxy to the [`KiteConnector.isOSSupported`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#isossupported) method.

##### .isOSVersionSupported()

A proxy to the [`KiteConnector.isOSVersionSupported`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#isosversionsupported). method

##### .isUserAuthenticated()

A proxy to the [`KiteConnector.isUserAuthenticated`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#isuserauthenticated). method

##### .onDidFailRequest(listener)

A proxy to the [`KiteConnector.onDidFailRequest`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#ondidfailrequestlistener) method.

##### .request(options, data, timeout)

A proxy to the [`KiteConnector.request`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#requestoptions-data-timeout) method.

##### .runKite()

A proxy to the [`KiteConnector.runKite`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#runkite) method.

##### .runKiteAndWait()

A proxy to the [`KiteConnector.runKiteAndWait`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#runkiteandwait) method.

##### .runKiteEnterprise()

A proxy to the [`KiteConnector.runKiteEnterprise`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#runkiteenterprise) method.

##### .runKiteEnterpriseAndWait()

A proxy to the [`KiteConnector.runKiteEnterpriseAndWait`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#runkiteenterpriseandwait) method.

##### .toggleRequestDebug()

A proxy to the [`KiteConnector.toggleRequestDebug`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#togglerequestdebug) method.

##### .waitForKite(attempts, interval)

A proxy to the [`KiteConnector.waitForKite`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#waitforkiteattempts-interval) method.
