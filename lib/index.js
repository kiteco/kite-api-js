'use strict';

const querystring = require('querystring');
const KiteConnector = require('kite-connect');
const KiteError = require('kite-connect/lib/kite-error');
const utils = require('kite-connect/lib/utils');
const EditorConfig = require('./editor-config');
const {STATES} = KiteConnector;

const KiteAPI = {
  editorConfig: new EditorConfig(),

  canAuthenticateUser() {
    return KiteConnector.isKiteReachable()
    .then(() => utils.reversePromise(
      KiteConnector.isUserAuthenticated(),
      new KiteError('bad_state', STATES.AUTHENTICATED)));
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

  isPathWhitelisted(path) {
    return !path
      ? Promise.reject(new KiteError('no path provided'))
      : this.request({
        path: `/clientapi/permissions/authorized?filename=${encodeURI(path)}`,
        method: 'GET',
      })
      .then(resp => utils.handleResponseData(resp));
  },

  canWhitelistPath(path) {
    return utils.reversePromise(this.isPathWhitelisted(path),
      new KiteError('bad_state', STATES.WHITELISTED))
    .then(() => this.request({
      path: `/clientapi/projectdir?filename=${encodeURI(path)}`,
      method: 'GET',
    }))
    .then(resp => utils.handleResponseData(resp));
  },

  whitelistPath(path) {
    return this.canWhitelistPath(path)
    .then(() => this.request({
      path: '/clientapi/permissions/whitelist',
      method: 'PUT',
    }, JSON.stringify([path])))
    .then(resp => this.saveUserID());
  },

  blacklistPath(path, noAction = false) {
    return this.canWhitelistPath(path)
    .then(() => this.request({
      path: '/clientapi/permissions/blacklist',
      method: 'PUT',
    }, JSON.stringify({
      paths: [path],
      closed_whitelist_notification_without_action: noAction,
    })));
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
