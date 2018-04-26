'use strict';

const sinon = require('sinon');
const expect = require('expect.js');
const KiteConnector = require('kite-connect');
const {withKite, withKiteRoutes} = require('kite-connect/test/helpers/support');
const {waitsForPromise} = require('kite-connect/test/helpers/async');
const {fakeResponse} = require('kite-connect/test/helpers/http');

const KiteAPI = require('../lib');
const TestStore = require('./helpers/stores/test');
const withKiteLogin = require('./helpers/login');

describe('KiteAPI', () => {
  beforeEach(() => {
    KiteAPI.editorConfig.store = new TestStore();
  });

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
      const stub = sinon.stub(KiteConnector, method).callsFake(() => {});
      KiteAPI[method]('foo', 'bar');
      expect(KiteConnector[method].calledWith('foo', 'bar')).to.be.ok();
      stub.restore();
    });
  });

  describe('.canAuthenticateUser()', () => {
    withKite({reachable: false}, () => {
      it('returns a rejecting promise', () => {
        return waitsForPromise({shouldReject: true}, () => KiteAPI.canAuthenticateUser());
      });
    });

    withKite({logged: true}, () => {
      it('returns a rejecting promise', () => {
        return waitsForPromise({shouldReject: true}, () => KiteAPI.canAuthenticateUser());
      });
    });

    withKite({logged: false}, () => {
      it('returns a resolving promise', () => {
        return waitsForPromise(() => KiteAPI.canAuthenticateUser());
      });
    });
  });

  describe('.authenticateUser()', () => {
    withKite({reachable: false}, () => {
      it('returns a rejected promise', () => {
        waitsForPromise({shouldReject: true}, () => KiteAPI.canAuthenticateUser());
      });
    });

    withKite({reachable: true}, () => {
      describe('and the authentication succeeds', () => {
        withKiteLogin(200);

        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.authenticateUser('email', 'password'));
        });

        it('writes the user id in the editor config', () => {
          return waitsForPromise(() => KiteAPI.authenticateUser('email', 'password'))
          .then(() => KiteAPI.editorConfig.get('distinctID'))
          .then(id => {
            expect(id).to.eql('some-id');
          });
        });
      });

      describe('and the authentication fails', () => {
        withKiteLogin(401);

        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.authenticateUser('email', 'password'));
        });
      });
    });
  });

  describe('.authenticateSessionID()', () => {
    withKite({reachable: false}, () => {
      it('returns a rejected promise', () => {
        return waitsForPromise({shouldReject: true}, () => KiteAPI.canAuthenticateUser());
      });
    });

    withKite({reachable: true}, () => {
      describe('and the authentication succeeds', () => {
        withKiteLogin(200);

        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.authenticateSessionID('key'));
        });

        it('writes the user id in the editor config', () => {
          return waitsForPromise(() => KiteAPI.authenticateUser('email', 'password'))
          .then(() => KiteAPI.editorConfig.get('distinctID'))
          .then(id => {
            expect(id).to.eql('some-id');
          });
        });
      });

      describe('and the authentication fails', () => {
        withKiteLogin(401);

        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.authenticateSessionID('key'));
        });
      });
    });
  });
});
