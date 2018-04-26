'use strict';

const KiteConnector = require('kite-connect');

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
], KiteConnector, {

});
