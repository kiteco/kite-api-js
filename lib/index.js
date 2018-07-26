'use strict';

const os = require('os');
const querystring = require('querystring');
const KiteConnector = require('kite-connector');
const KiteError = require('kite-connector/lib/kite-error');
const utils = require('kite-connector/lib/utils');
const NodeClient = require('kite-connector/lib/clients/node');
const BrowserClient = require('kite-connector/lib/clients/browser');
const EventEmitter = require('events');
const EditorConfig = require('./editor-config');
const MemoryStore = require('./stores/memory');
const {STATES} = KiteConnector;
const {MAX_FILE_SIZE} = require('./constants');
const {merge, checkArguments, checkArgumentKeys} = require('./utils');
const urls = require('./url-helpers');

const KiteAPI = {
  STATES,

  emitter: new EventEmitter(),

  editorConfig: new EditorConfig(new MemoryStore()),

  toggleRequestDebug() {
    KiteConnector.toggleRequestDebug();
    this.Account.toggleRequestDebug();
  },

  onDidDetectWhitelistedPath(listener) {
    this.emitter.on('did-detect-whitelisted-path', listener);
    return {
      dispose: () => {
        this.emitter.removeListener('did-detect-whitelisted-path', listener);
      },
    };
  },

  onDidDetectNonWhitelistedPath(listener) {
    this.emitter.on('did-detect-non-whitelisted-path', listener);
    return {
      dispose: () => {
        this.emitter.removeListener('did-detect-non-whitelisted-path', listener);
      },
    };
  },

  emitWhitelistedPathDetected(path) {
    return (data) => {
      this.emitter.emit('did-detect-whitelisted-path', path);
      return data;
    };
  },

  emitNonWhitelistedPathDetected(path) {
    return (err) => {
      if (err.resp && err.resp.statusCode === 403) {
        this.emitter.emit('did-detect-non-whitelisted-path', path);
      }
      throw err;
    };
  },

  requestJSON(...args) {
    return this.request(...args)
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
    checkArguments(this.authenticateUser, email, password);
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
    // Unlike authenticateUser above, this method does not check to see if a
    // user is already authenticated before trying to authenticate. This
    // method is only used in specialized flows, so we're special-casing it
    // here.
    checkArguments(this.authenticateSessionID, key);
    return KiteConnector.isKiteReachable()
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
    checkArguments(this.isPathWhitelisted, path);
    return this.request({
      path: `/clientapi/permissions/authorized?filename=${encodeURI(path)}`,
      method: 'GET',
    })
    .then(this.emitWhitelistedPathDetected(path))
    .catch(this.emitNonWhitelistedPathDetected(path))
    .then(resp => utils.handleResponseData(resp));
  },

  canWhitelistPath(path) {
    checkArguments(this.canWhitelistPath, path);
    return utils.reversePromise(this.isPathWhitelisted(path),
      new KiteError('bad_state', STATES.WHITELISTED))
    .then(() => this.request({
      path: `/clientapi/projectdir?filename=${encodeURI(path)}`,
      method: 'GET',
    }))
    .then(resp => utils.handleResponseData(resp));
  },

  whitelistPath(path) {
    checkArguments(this.whitelistPath, path);
    return this.canWhitelistPath(path)
    .then(() => this.request({
      path: '/clientapi/permissions/whitelist',
      method: 'PUT',
    }, JSON.stringify([path])))
    .then(this.emitWhitelistedPathDetected(path))
    .catch(this.emitNonWhitelistedPathDetected(path))
    .then(resp => this.saveUserID());
  },

  blacklistPath(path, noAction = false) {
    checkArguments(this.blacklistPath, path);
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

  getHoverDataAtPosition(filename, source, position, editor) {
    checkArguments(this.getHoverDataAtPosition, filename, source, position);
    const path = urls.hoverPath(filename, source, position, editor);

    return this.requestJSON({path})
    .then(this.emitWhitelistedPathDetected(filename))
    .catch(this.emitNonWhitelistedPathDetected(filename));
  },

  getReportDataAtPosition(filename, source, position, editor) {
    checkArguments(this.getReportDataAtPosition, filename, source, position, editor);
    return this.getHoverDataAtPosition(filename, source, position, editor)
    .then(data => this.getReportDataFromHover(data))
    .then(this.emitWhitelistedPathDetected(filename))
    .catch(this.emitNonWhitelistedPathDetected(filename));
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
    checkArguments(this.getSymbolReportDataForId, id);
    return this.requestJSON({
      path: `/api/editor/symbol/${id}`,
    });
  },

  getValueReportDataForId(id) {
    checkArguments(this.getValueReportDataForId, id);
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
    checkArguments(this.getMembersDataForId, id);
    const path = urls.membersPath(id, page, limit);

    return this.requestJSON({path});
  },

  getUsagesDataForValueId(id, page = 0, limit = 999) {
    checkArguments(this.getUsagesDataForValueId, id);
    const path = urls.usagesPath(id, page, limit);

    return this.requestJSON({path});
  },

  getUsageDataForId(id) {
    checkArguments(this.getUsageDataForId, id);
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
    checkArguments(this.getExampleDataForId, id);
    return this.requestJSON({
      path: `/api/python/curation/${id}`,
    });
  },

  getUserAccountInfo() {
    return this.requestJSON({path: '/api/account/user'});
  },

  isFileAuthorized(filename) {
    return this.isPathWhitelisted(filename);
  },

  shouldOfferWhitelist(filename) {
    checkArguments(this.shouldOfferWhitelist, filename);
    return this.shouldNotify(filename)
    .then(res => res && this.projectDirForFile(filename))
    .then(path => path ? path : null);
  },

  shouldNotify(filename) {
    checkArguments(this.shouldNotify, filename);
    const path = urls.shouldNotifyPath(filename);

    return this.request({path})
    .then(resp => true)
    .catch(() => false);
  },

  projectDirForFile(filename) {
    checkArguments(this.projectDirForFile, filename);
    const path = urls.projectDirPath(filename);

    return this.request({path})
    .then(resp => utils.handleResponseData(resp));
  },

  getStatus(filename) {
    return filename
      ? this.requestJSON({path: urls.statusPath(filename)})
        .catch((err) => ({status: 'ready'}))
      : Promise.resolve({status: 'ready'});
  },

  getCompletionsAtPosition(filename, source, position, editor) {
    checkArguments(this.getCompletionsAtPosition, filename, source, position, editor);
    if (source.length > MAX_FILE_SIZE) { return Promise.resolve([]); }

    const payload = {
      text: source,
      editor,
      filename,
      cursor_runes: position,
    };

    return this.requestJSON({
      path: '/clientapi/editor/completions',
      method: 'POST',
    }, JSON.stringify(payload))
    .then(this.emitWhitelistedPathDetected(filename))
    .catch(this.emitNonWhitelistedPathDetected(filename))
    .then(data => data.completions || [])
    .catch(err => []);
  },

  getSignaturesAtPosition(filename, source, position, editor) {
    checkArguments(this.getSignaturesAtPosition, filename, source, position, editor);
    if (source.length > MAX_FILE_SIZE) { return Promise.resolve(); }

    const payload = {
      text: source,
      editor,
      filename,
      cursor_runes: position,
    };

    return this.requestJSON({
      path: '/clientapi/editor/signatures',
      method: 'POST',
    }, JSON.stringify(payload))
    .then(this.emitWhitelistedPathDetected(filename))
    .catch(this.emitNonWhitelistedPathDetected(filename))
    .catch(() => {});
  },

  getAutocorrectData(filename, source, editorMeta) {
    checkArguments(this.getAutocorrectData, filename, source, editorMeta);

    if (source.length > MAX_FILE_SIZE) { return Promise.resolve(); }

    const payload = {
      metadata: this.getAutocorrectMetadata('autocorrect_request', editorMeta),
      buffer: source,
      filename,
      language: 'python',
    };

    return this.requestJSON({
      path: '/clientapi/editor/autocorrect',
      method: 'POST',
    }, JSON.stringify(payload))
    .then(this.emitWhitelistedPathDetected(filename))
    .catch(this.emitNonWhitelistedPathDetected(filename))
    .catch(() => {});
  },

  getAutocorrectModelInfo(version, editorMeta) {
    checkArguments(this.getAutocorrectModelInfo, version, editorMeta);

    const payload = {
      metadata: this.getAutocorrectMetadata('model_info_request', editorMeta),
      language: 'python',
      version,
    };

    return this.requestJSON({
      path: '/api/editor/autocorrect/model-info',
      method: 'POST',
    }, JSON.stringify(payload))
    .catch(() => {});
  },

  getAutocorrectMetadata(event, editorMeta) {
    checkArguments(this.getAutocorrectMetadata, event, editorMeta);
    checkArgumentKeys(this.getAutocorrectMetadata, editorMeta, 'editorMeta', 'source', 'plugin_version');
    return merge({
      event,
      os_name: this.getOsName(),
    }, editorMeta);
  },

  getOsName() {
    return {
      darwin: 'macos',
      win32: 'windows',
    }[os.platform()];
  },

  postSaveValidationData(filename, source, editorMeta) {
    checkArguments(this.postSaveValidationData, filename, source, editorMeta);

    if (source.length > MAX_FILE_SIZE) { return Promise.resolve(); }

    const payload = {
      metadata: this.getAutocorrectMetadata('validation_onsave', editorMeta),
      buffer: source,
      filename,
      language: 'python',
    };

    return this.request({
      path: '/clientapi/editor/autocorrect/validation/on-save',
      method: 'POST',
    }, JSON.stringify(payload))
    .catch(() => {});
  },

  postAutocorrectFeedbackData(response, feedback, editorMeta) {
    checkArguments(this.postAutocorrectFeedbackData, response, feedback, editorMeta);

    const payload = {
      metadata: this.getAutocorrectMetadata('feedback_diffset', editorMeta),
      response,
      feedback,
    };

    return this.request({
      path: '/clientapi/editor/autocorrect/feedback',
      method: 'POST',
    }, JSON.stringify(payload))
    .catch(() => {});
  },

  postAutocorrectHashMismatchData(response, requestStartTime, editorMeta) {
    checkArguments(this.postAutocorrectHashMismatchData, response, requestStartTime, editorMeta);

    const payload = {
      metadata: this.getAutocorrectMetadata('metrics_hash_mismatch', editorMeta),
      response,
      response_time: new Date() - requestStartTime,
    };

    return this.request({
      path: '/clientapi/editor/autocorrect/metrics',
      method: 'POST',
    }, JSON.stringify(payload))
    .catch(() => {});
  },

  sendFeatureMetric(name) {
    checkArguments(this.sendFeatureMetric, name);

    return this.request({
      path: '/clientapi/metrics/counters',
      method: 'POST',
    }, JSON.stringify({
      name,
      value: 1,
    }));
  },

  featureRequested(name, editor) {
    checkArguments(this.featureRequested, name, editor);
    this.sendFeatureMetric(`${editor}_${name}_requested`);
  },

  featureFulfilled(name, editor) {
    checkArguments(this.featureFulfilled, name, editor);
    this.sendFeatureMetric(`${editor}_${name}_fulfilled`);
  },

  featureApplied(name, editor, suffix = '') {
    checkArguments(this.featureApplied, name, editor);
    this.sendFeatureMetric(`${editor}_${name}_applied${suffix}`);
  },

  Account: {
    client: KiteConnector.client,

    initClient(hostname, port) {
      this.client.hostname = hostname;
      this.client.port = port;
    },

    disposeClient() {},

    toggleRequestDebug() {
      if (this.client instanceof NodeClient) {
        this.client = new BrowserClient(this.client.hostname, this.client.port);
      } else {
        this.client = new NodeClient(this.client.hostname, this.client.port);
      }
    },

    checkEmail(data) {
      if (!data || !data.email) {
        return Promise.reject(new Error('No email provided'));
      }
      return this.client.request({
        path: '/api/account/check-email',
        method: 'POST',
      }, JSON.stringify(data))
      .then(checkStatusAndInvokeCallback());
    },

    createAccount(data, callback) {
      if (!data || !data.email) {
        return Promise.reject(new Error('No email provided'));
      }

      const content = querystring.stringify(data);
      let promise;
      if (data.password) {
        promise = this.client.request({
          path: '/api/account/create',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }, content);
      } else {
        promise = this.client.request({
          path: '/api/account/createPasswordless',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }, content);
      }

      return promise.then(checkStatusAndInvokeCallback(callback));
    },

    login(data, callback) {
      if (!data) {
        return Promise.reject(new Error('No login data provided'));
      }
      if (!data.email) {
        return Promise.reject(new Error('No email provided'));
      }
      if (!data.password) {
        return Promise.reject(new Error('No password provided'));
      }
      const content = querystring.stringify(data);
      return this.client.request({
        path: '/api/account/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }, content)
      .then(checkStatusAndInvokeCallback(callback));
    },

    resetPassword(data, callback) {
      if (!data || !data.email) {
        return Promise.reject(new Error('No email provided'));
      }
      const content = querystring.stringify(data);
      return this.client.request({
        path: '/api/account/reset-password/request',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }, content)
      .then(checkStatusAndInvokeCallback(callback));
    },
  },
};

const idIsEmpty = (id) =>
  !id || id === '' ||
  (id.indexOf(';') !== -1 && id.split(';')[1] === '');

const delegate = (methods, source, target) => {
  methods.forEach(method => target[method] = (...args) => source[method](...args));
  return target;
};

const checkStatusAndInvokeCallback = callback => resp => {
  callback && callback(resp);
  if (resp.statusCode >= 400) {
    throw new KiteError('bad_status', resp.statusCode, null, resp);
  }
  return resp;
};

delegate([
  'arch',
  'canInstallKite',
  'canRunKite',
  'canRunKiteEnterprise',
  'checkHealth',
  'downloadKite',
  'downloadKiteRelease',
  'hasBothKiteInstalled',
  'hasManyKiteEnterpriseInstallation',
  'hasManyKiteInstallation',
  'installKite',
  'isAdmin',
  'isKiteEnterpriseInstalled',
  'isKiteEnterpriseRunning',
  'isKiteInstalled',
  'isKiteReachable',
  'isKiteRunning',
  'isKiteSupported',
  'isOSSupported',
  'isOSVersionSupported',
  'isUserAuthenticated',
  'onDidFailRequest',
  'request',
  'runKite',
  'runKiteAndWait',
  'runKiteEnterprise',
  'runKiteEnterpriseAndWait',
  'toggleRequestDebug',
  'waitForKite',
], KiteConnector, KiteAPI);

module.exports = KiteAPI;
