'use strict';

const os = require('os');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const KiteConnector = require('kite-connector');
const KiteStateError = require('kite-connector/lib/kite-state-error');
const KiteRequestError = require('kite-connector/lib/kite-request-error');
const utils = require('kite-connector/lib/utils');
const NodeClient = require('kite-connector/lib/clients/node');
const BrowserClient = require('kite-connector/lib/clients/browser');
const EventEmitter = require('events');
const EditorConfig = require('./editor-config');
const MemoryStore = require('./stores/memory');
const { STATES } = KiteConnector;
const { merge, checkArguments, checkArgumentKeys } = require('./utils');
const urls = require('./url-helpers');

const KiteAPI = {
  STATES,

  emitter: new EventEmitter(),

  editorConfig: new EditorConfig(new MemoryStore()),

  DEFAULT_MAX_FILE_SIZE: 1048576,

  toggleRequestDebug() {
    KiteConnector.toggleRequestDebug();
    this.Account.toggleRequestDebug();
  },

  requestJSON(...args) {
    return this.request(...args)
      .then(resp => utils.handleResponseData(resp))
      .then(data => JSON.parse(data));
  },

  isKiteLocal() {
    return this.request({
      path: '/clientapi/iskitelocal',
      method: 'GET',
    })
      .then(() => true)
      .catch(() => false);
  },

  setKiteSetting(key, value) {
    return this.requestJSON({
      path: `/clientapi/settings/${key}`,
      method: 'POST',
    }, JSON.stringify(value));
  },

  getKiteSetting(key) {
    return this.requestJSON({
      path: `/clientapi/settings/${key}`,
      method: 'GET',
    });
  },

  getMaxFileSizeBytes() {
    return KiteAPI.getKiteSetting('max_file_size_kb')
      .then(res => res * Math.pow(2, 10))
      .catch(_ => this.DEFAULT_MAX_FILE_SIZE); // default to 1 MB
  },

  getSupportedLanguages() {
    return this.requestJSON({
      path: '/clientapi/languages',
    });
  },

  getOnboardingFilePath(editor, language = 'python') {
    checkArguments(this.getOnboardingFilePath, editor, language);
    const path = urls.onboardingFilePath(editor, language);
    return this.requestJSON({ path });
  },

  canAuthenticateUser() {
    return KiteConnector.isKiteReachable()
      .then(() => utils.reversePromise(
        KiteConnector.isUserAuthenticated(),
        new KiteStateError('Kite is already authenticated', {
          state: STATES.AUTHENTICATED,
        })));
  },

  authenticateUser(email, password) {
    checkArguments(this.authenticateUser, email, password);
    return this.canAuthenticateUser()
      .then(() => this.request({
        path: '/clientapi/login',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }, { email, password }))
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
        path: '/clientapi/authenticate',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }, { key }))
      .then(resp => this.saveUserID());
  },

  saveUserID() {
    return this.requestJSON({
      path: '/clientapi/user',
      method: 'GET',
    })
      .then(data => data.id && this.editorConfig.set('distinctID', data.id))
      .catch(() => { });
  },

  getHoverDataAtPosition(filename, source, position, editor, encoding = 'utf-16') {
    checkArguments(this.getHoverDataAtPosition, filename, source, position, encoding);
    const path = urls.hoverPath(filename, source, position, editor, encoding);

    return this.requestJSON({ path });
  },

  getReportDataAtPosition(filename, source, position, editor, encoding = 'utf-16') {
    checkArguments(this.getReportDataAtPosition, filename, source, position, editor, encoding);
    return this.getHoverDataAtPosition(filename, source, position, editor, encoding)
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

    return this.requestJSON({ path });
  },

  getUsagesDataForValueId(id, page = 0, limit = 999) {
    checkArguments(this.getUsagesDataForValueId, id);
    const path = urls.usagesPath(id, page, limit);

    return this.requestJSON({ path });
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
    return this.requestJSON({ path: '/api/account/user' });
  },

  getStatus(filename) {
    return filename
      ? this.requestJSON({ path: urls.statusPath(filename) })
        .catch((err) => ({ status: 'ready' }))
      : Promise.resolve({ status: 'ready' });
  },

  getCompletions(payload) {
    checkArguments(this.getCompletions, payload);
    if (payload.text === undefined) {
      return Promise.resolve([]);
    }
    return this.requestJSON({
      path: '/clientapi/editor/complete',
      method: 'POST',
    }, JSON.stringify(payload))
      .then(data => data.completions || [])
      .catch(_ => []);
  },

  getLineDecoration(filename) {
    return this.requestJSON(
      {
        path: '/codenav/decoration/line',
        method: 'POST',
      },
      JSON.stringify({ filename })
    );
  },

  requestRelatedCode(editor, editor_install_path, filename, line, selection) {
    return this.request(
      {
        path: '/codenav/editor/related',
        method: 'POST',
      },
      JSON.stringify({
        editor,
        editor_install_path,
        location: {
          filename,
          line,
          selection,
        },
      })
    );
  },

  getSignaturesAtPosition(filename, source, position, editor, encoding = 'utf-16') {
    checkArguments(this.getSignaturesAtPosition, filename, source, position, editor, encoding);

    const payload = {
      text: source,
      editor,
      filename,
      cursor_runes: position,
      offset_encoding: encoding,
    };

    return this.requestJSON({
      path: '/clientapi/editor/signatures',
      method: 'POST',
    }, JSON.stringify(payload))
      .catch(() => { });
  },

  getKSGCompletions(query) {
    checkArguments(this.getKSGCompletions, query);
    return this.requestJSON({ path: `/clientapi/ksg/completions?query=${encodeURIComponent(query)}` })
      .catch(() => { });
  },

  getKSGCodeBlocks(query, results = 3) {
    checkArguments(this.getKSGCodeBlocks, query, results);
    return this.requestJSON({ path: `/clientapi/ksg/codeblocks?query=${encodeURIComponent(query)}&results=${results}` })
      .catch(() => { });
  },

  getAutocorrectData(filename, source, editorMeta) {
    checkArguments(this.getAutocorrectData, filename, source, editorMeta);

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
      .catch(() => { });
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
      .catch(() => { });
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
      linux: 'linux',
    }[os.platform()];
  },

  postSaveValidationData(filename, source, editorMeta) {
    checkArguments(this.postSaveValidationData, filename, source, editorMeta);

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
      .catch(() => { });
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
      .catch(() => { });
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
      .catch(() => { });
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

    initClient(hostname, port, base, ssl) {
      this.client.hostname = hostname;
      this.client.port = port;
      this.client.base = base;
      this.client.protocol = ssl ? https : http;
    },

    disposeClient() { },

    toggleRequestDebug() {
      if (this.client instanceof NodeClient) {
        this.client = new BrowserClient(this.client.hostname, this.client.port, this.client.base, this.client.protocol === https);
      } else {
        this.client = new NodeClient(this.client.hostname, this.client.port, this.client.base, this.client.protocol === 'https');
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
        .then(checkStatusAndInvokeCallback('Unable to check email'));
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

      return promise.then(checkStatusAndInvokeCallback('Unable to create an account', callback));
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
        .then(checkStatusAndInvokeCallback('Unable to login into Kite', callback));
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
        .then(checkStatusAndInvokeCallback('Unable to reset passwords', callback));
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

const checkStatusAndInvokeCallback = (message, callback) => resp => {
  callback && callback(resp);
  return new Promise((resolve, reject) => {
    if (resp.statusCode >= 400) {
      utils.handleResponseData(resp).then(respData => {
        reject(new KiteRequestError(message, {
          responseStatus: resp.statusCode,
          response: resp,
          responseData: respData,
        }));
      }, reject);
    } else {
      resolve(resp);
    }
  });
};

delegate([
  'arch',
  'canInstallKite',
  'canRunKite',
  'canRunKiteEnterprise',
  'checkHealth',
  'canDownloadKite',
  'downloadKite',
  'downloadKiteRelease',
  'hasKiteRun',
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
  'runKiteWithCopilot',
  'runKite',
  'runKiteAndWait',
  'runKiteEnterprise',
  'runKiteEnterpriseAndWait',
  'toggleRequestDebug',
  'waitForKite',
], KiteConnector, KiteAPI);

module.exports = KiteAPI;
