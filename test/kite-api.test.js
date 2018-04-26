'use strict';

const sinon = require('sinon');
const expect = require('expect.js');
const KiteConnector = require('kite-connect');
const {withKite, withKiteRoutes} = require('kite-connect/test/helpers/support');

const KiteAPI = require('../lib');

describe('KiteAPI', () => {
  [
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
  ].forEach(method => {
    it(`delegates calls to ${method} to the connector`, () => {
      sinon.stub(KiteConnector, method).callsFake(() => {});
      KiteAPI[method]('foo', 'bar');
      expect(KiteConnector[method].calledWith('foo', 'bar')).to.be.ok();
    });
  });
});
