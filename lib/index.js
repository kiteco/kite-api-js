'use strict';

const os = require('os');
const querystring = require('querystring');
const KiteConnector = require('kite-connect');
const KiteError = require('kite-connect/lib/kite-error');
const utils = require('kite-connect/lib/utils');
const EditorConfig = require('./editor-config');
const {STATES} = KiteConnector;
const {MAX_FILE_SIZE} = require('./constants');
const {merge, checkArguments, checkArgumentKeys} = require('./utils');
const urls = require('./url-helpers');

const KiteAPI = {
  editorConfig: new EditorConfig(),

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
    checkArguments(email, password);
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
    checkArguments(key);
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
    checkArguments(path);
    return this.request({
      path: `/clientapi/permissions/authorized?filename=${encodeURI(path)}`,
      method: 'GET',
    })
    .then(resp => utils.handleResponseData(resp));
  },

  canWhitelistPath(path) {
    checkArguments(path);
    return utils.reversePromise(this.isPathWhitelisted(path),
      new KiteError('bad_state', STATES.WHITELISTED))
    .then(() => this.request({
      path: `/clientapi/projectdir?filename=${encodeURI(path)}`,
      method: 'GET',
    }))
    .then(resp => utils.handleResponseData(resp));
  },

  whitelistPath(path) {
    checkArguments(path);
    return this.canWhitelistPath(path)
    .then(() => this.request({
      path: '/clientapi/permissions/whitelist',
      method: 'PUT',
    }, JSON.stringify([path])))
    .then(resp => this.saveUserID());
  },

  blacklistPath(path, noAction = false) {
    checkArguments(path);
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
    checkArguments(filename, source, position);
    const path = urls.hoverPath(filename, source, position);

    return this.requestJSON({path});
  },

  getReportDataAtPosition(filename, source, position) {
    checkArguments(filename, source, position);
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
    checkArguments(id);
    return this.requestJSON({
      path: `/api/editor/symbol/${id}`,
    });
  },

  getValueReportDataForId(id) {
    checkArguments(id);
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
    checkArguments(id);
    const path = urls.membersPath(id, page, limit);

    return this.requestJSON({path});
  },

  getUsagesDataForValueId(id, page = 0, limit = 999) {
    checkArguments(id);
    const path = urls.usagesPath(id, page, limit);

    return this.requestJSON({path});
  },

  getUsageDataForId(id) {
    checkArguments(id);
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
    checkArguments(id);
    return this.requestJSON({
      path: `/api/python/curation/${id}`,
    });
  },

  getUserAccountInfo() {
    return this.requestJSON({path: '/api/account/user'});
  },

  isFileAuthorized(filename) {
    checkArguments(filename);
    return this.request({
      path: `/clientapi/permissions/authorized?filename=${filename}`,
    });
  },

  shouldOfferWhitelist(filename) {
    checkArguments(filename);
    return this.projectDirForFile(filename)
    .then(path =>
      this.shouldNotify(filename)
      .then(res => res ? path : null));
  },

  shouldNotify(filename) {
    checkArguments(filename);
    const path = urls.shouldNotifyPath(filename);

    return this.request({path})
    .then(resp => true)
    .catch(() => false);
  },

  projectDirForFile(filename) {
    checkArguments(filename);
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
    checkArguments(filename, source, position, editor);
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
    .then(data => data.completions || [])
    .catch(err => []);
  },

  getSignaturesAtPosition(filename, source, position, editor) {
    checkArguments(filename, source, position, editor);
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
    .catch(() => {});
  },

  getAutocorrectData(filename, source, editorMeta) {
    checkArguments(filename, source, editorMeta);

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
    .catch(() => {});
  },

  getAutocorrectModelInfo(version, editorMeta) {
    checkArguments(version, editorMeta);

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
    checkArgumentKeys(editorMeta, 'source', 'plugin_version');
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
    checkArguments(filename, source, editorMeta);

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
    checkArguments(response, feedback, editorMeta);

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
    checkArguments(response, requestStartTime, editorMeta);

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
