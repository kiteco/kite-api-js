## Kite API

[![Build Status](https://travis-ci.org/kiteco/kite-api-js.svg?branch=master)](https://travis-ci.org/kiteco/kite-api-js) [![codecov](https://codecov.io/gh/kiteco/kite-api-js/branch/master/graph/badge.svg)](https://codecov.io/gh/kiteco/kite-api-js)

#### .STATES

An object containing the constant values of the various states of `kited`

| State           | Value | Alias         |
| --------------- | ----- | ------------- |
| UNSUPPORTED     | `0`   |               |
| UNINSTALLED     | `1`   |               |
| NOT_RUNNING     | `2`   | INSTALLED     |
| NOT_REACHABLE   | `3`   | RUNNING       |
| UNLOGGED        | `4`   | REACHABLE     |
| NOT_WHITELISTED | `5`   | AUTHENTICATED |
| WHITELISTED     | `6`   | &nbsp;        |

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

Registers a listener to the `did-detect-whitelisted-path` event and will be notified when a request for an editor API responds with a `200`. The listener will be invoked with the path that have been detected as whitelisted.

The function returns a disposable object to unregister the listener from this event.

```js
const disposable = KiteAPI.onDidDetectWhitelistedPath(path => {
  // path is whitelisted
})

disposable.dispose(); // the listener will no longer receive events
```

#### .onDidDetectNonWhitelistedPath(listener)

Registers a listener to the `did-detect-non-whitelisted-path` event and will be notified when a request for an editor API responds with a `403`. The listener will be invoked with the path that have been detected as not whitelisted.

The function returns a disposable object to unregister the listener from this event.

```js
const disposable = KiteAPI.onDidDetectNonWhitelistedPath(path => {
  // path is not whitelisted
})

disposable.dispose(); // the listener will no longer receive events
```

#### .requestJSON(options, data, timeout)

Makes a request to Kite using [`KiteConnector.request`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#requestoptions-data-timeout) and automatically parses the JSON response when the status code was `200`.

```js
KiteAPI.requestJSON({path}).then(data => {
  // data is the result of JSON.parse on the response text
})
```

#### .isKiteLocal()

Makes a `GET` request to Kite at the endpoint `/clientapi/iskitelocal`. Responds with a boolean resolving Promise to `true` in the case of a `200` status code, `false` otherwise

```js
KiteAPI.isKiteLocal().then(isLocal => {
  // do stuff related to kite-locality
})
```

#### .setKiteSetting(key, value)

Makes a `POST` request to Kite at the endpoint `/clientapi/settings/${key}`, where the body is set to `value`. It automatically parses the JSON response when the status code is `200`

```js
KiteAPI.setKiteSetting('some_setting_name', 'a_value')
```

#### .getKiteSetting(key)

Makes a `GET` request to Kite at the endpoint `/clientapi/settings/${key}`. It automatically parses the JSON response when the status code is `200`

```js
KiteAPI.getKiteSetting('some_setting').then(settingValue => {
  // do something with settingValue
})
```

#### .canAuthenticateUser()

Returns a promise that resolves if a user can be authenticated. A user can be authenticated if Kite is reachable and if the user is not already logged into Kite.

```js
KiteAPI.canAuthenticateUser().then(() => {
  // user can be authenticated
})
```

#### .authenticateUser(email, password)

Makes a request to authenticate the user through Kite and returns a promise that will resolve if the authentication succeeds.

```js
KiteAPI.authenticateUser('john@doe.com', 'password')
.then(() => {
  // User is logged in
})
.catch(err => {
  // authentication failed
})
```

#### .authenticateSessionID(key)

Makes a request to authenticate a user using a session id and returns a promise that will resolve if the authentication succeeds. This function can be used to authenticate a user in Kite whose account have been created using `kite.com` API.

```js
KiteAPI.authenticateSessionID('session-id')
.then(() => {
  // User is logged in
})
.catch(err => {
  // authentication failed
})
```

#### .isPathWhitelisted(path)

Returns a promise that resolves if the `path` is part of the whitelist, otherwise the promise will be rejected.

When calling that function, depending on the outcome, a `did-detect-whitelisted-path` or `did-detect-non-whitelisted-path` event will be dispatched.

```js
KiteAPI.isPathWhitelisted(path)
.then(() => {
  // path is whitelisted
})
.catch(err => {
  // path is not whitelisted or an error occurred
  // err contains the details of the failure
})
```

#### .canWhitelistPath(path)

Returns a promise that resolves if the `path` can be whitelisted.
A path can be whitelisted if it's not already part of the whitelist and if the `projectdir` endpoint responds with a `200`.

In case of success, the promise resolves with the path returned by the `projectdir` endpoint.

```js
KiteAPI.canWhitelistPath(path).then(projectDir => {
  // projectDir can be sent to the whitelist endpoint
})
```

#### .whitelistPath(path)

Makes a request to the whitelist endpoint and returns a promise that resolves if the path have been successfully whitelisted.

```js
KiteAPI.whitelistPath(path).then(() => {
  // path is now whitelisted
})
```

#### .blacklistPath(path, noAction)

Makes a request to the blacklist endpoint and returns a promise that resolves if the path have been successfully blacklisted. The `noAction` parameters will allow to set the `closed_whitelist_notification_without_action` value in the request, it defaults to `false`.

```js
KiteAPI.blacklistPath(path).then(() => {
  // path is now blacklisted
})
```

#### .getSupportedLanguages()

Makes a request to the languages endpoint and returns a promise that resolves with an array of the supported languages.

```js
KiteAPI.getSupportedLanguages().then(languages => {
  // do something with languages
})
```

#### .getOnboardingFilePath()

Makes a request to the onboarding_file endpoint and returns a promise that resolves with a filepath string.

```js
KiteAPI.getOnboardingFilePath().then(path => {
  // do something with path
})
```

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
#### .getCompletions(payload)
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

##### .runKiteWithCopilot()

A proxy to the [`KiteConnector.runKiteWithCopilot`](https://github.com/kiteco/kite-connect-js/blob/master/README.md#runkitewithcopilot) method.

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
