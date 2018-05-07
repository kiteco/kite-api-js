'use strict';

const querystring = require('querystring');
const KiteConnector = require('kite-connect');
const KiteError = require('kite-connect/lib/kite-error');
const utils = require('kite-connect/lib/utils');
const EditorConfig = require('./editor-config');
const {STATES} = KiteConnector;
const urls = require('./url-helpers');

const KiteAPI = {
  editorConfig: new EditorConfig(),

  requestJSON(query) {
    return this.request(query)
    .then(resp => utils.handleResponseData(resp))
    .then(data => JSON.parse(data));
  },

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
    return this.requestJSON({
      path: '/clientapi/user',
      method: 'GET',
    })
    .then(data => data.id && this.editorConfig.set('distinctID', data.id))
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

  getSupportedLanguages() {
    return this.requestJSON({
      path: '/clientapi/languages',
    });
  },

  getHoverDataAtPosition(filename, source, position) {
    const path = urls.hoverPath(filename, source, position);

    return this.requestJSON({path});
  },

  getReportDataAtPosition(filename, source, position) {
    return this.getHoverDataAtPosition(filename, source, position)
    .then(data => this.getReportDataFromHover(data));
  },

  getReportDataFromHover(data) {
    const id = data.symbol[0].id;
    return !idIsEmpty(id)
      ? this.getSymbolReportDataForId(id)
        .then(report => [data, report])
        .catch(err => [data])
      : [data];
  },

  getSymbolReportDataForId(id) {
    return this.requestJSON({
      path: `/api/editor/symbol/${id}`,
    });
  },

  getValueReportDataForId(id) {
    return this.requestJSON({
      path: `/api/editor/value/${id}`,
    })
    .then(report => {
      if (report.value && idIsEmpty(report.value.id)) {
        report.value.id = id;
      }
      return report;
    });
  },

  getMembersDataForId(id, page = 0, limit = 999) {
    const path = urls.membersPath(id, page, limit);

    return this.requestJSON({path});
  },

  getUsagesDataForValueId(id, page = 0, limit = 999) {
    const path = urls.usagesPath(id, page, limit);

    return this.requestJSON({path});
  },

  getUsageDataForId(id) {
    return this.requestJSON({
      path: `/api/editor/usages/${id}`,
    })
    .then(report => {
      if (report.value && idIsEmpty(report.value.id)) {
        report.value.id = id;
      }
      return report;
    });
  },

  getExampleDataForId(id) {
    return this.requestJSON({
      path: `/api/python/curation/${id}`,
    });
  },

  getUserAccountInfo() {
    return this.requestJSON({path: '/api/account/user'});
  },
};

const idIsEmpty = (id) =>
  !id || id === '' ||
  (id.indexOf(';') !== -1 && id.split(';')[1] === '');

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
