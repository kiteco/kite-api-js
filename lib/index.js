'use strict';

const querystring = require('querystring');
const KiteConnector = require('kite-connect');
const KiteError = require('kite-connect/lib/kite-error');
const utils = require('kite-connect/lib/utils');
const EditorConfig = require('./editor-config');

const KiteAPI = {
  editorConfig: new EditorConfig(),

  canAuthenticateUser() {
    return KiteConnector.isKiteReachable()
    .then(() => utils.reversePromise(
      KiteConnector.isUserAuthenticated(),
      new KiteError('bad_state', KiteConnector.STATES.AUTHENTICATED)));
  },

  authenticateUser(email, password) {
    return this.canAuthenticateUser()
    .then(() => this.request({
      path: '/api/account/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, querystring.stringify({email, password})))
    .then(() => this.saveUserID());
  },

  authenticateSessionID(key) {
    return this.canAuthenticateUser()
    .then(() => this.request({
      path: '/api/account/authenticate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, querystring.stringify({key})))
    .then(resp => this.saveUserID());
  },

  saveUserID() {
    return this.request({
      path: '/clientapi/user',
      method: 'GET',
    })
    .then(resp => utils.handleResponseData(resp))
    .then(data => {
      data = JSON.parse(data);
      if (data.id !== undefined) {
        return this.editorConfig.set('distinctID', data.id);
      }
      return null;
    })
    .catch(() => {});
  },
};

const delegate = (methods, source, target) => {
  methods.forEach(method => target[method] = (...args) => source[method](...args));
  return target;
};

module.exports = delegate([
  'checkHealth',
  'request',
  'onDidFailRequest',
  'isKiteSupported',
  'isKiteInstalled',
  'canInstallKite',
  'downloadKiteRelease',
  'downloadKite',
  'installKite',
  'isKiteRunning',
  'canRunKite',
  'runKite',
  'runKiteAndWait',
  'isKiteEnterpriseInstalled',
  'isKiteEnterpriseRunning',
  'canRunKiteEnterprise',
  'runKiteEnterprise',
  'runKiteEnterpriseAndWait',
  'isKiteReachable',
  'waitForKite',
  'isUserAuthenticated',
], KiteConnector, KiteAPI);
