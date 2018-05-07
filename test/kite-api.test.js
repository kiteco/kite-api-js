'use strict';

const url = require('url');
const md5 = require('md5');
const sinon = require('sinon');
const expect = require('expect.js');
const KiteConnector = require('kite-connect');
const {withKite, withKiteRoutes} = require('kite-connect/test/helpers/support');
const {waitsForPromise} = require('kite-connect/test/helpers/async');
const {fakeResponse} = require('kite-connect/test/helpers/http');

const KiteAPI = require('../lib');
const TestStore = require('./helpers/stores/test');
const {withKiteLogin, withKitePaths} = require('./helpers/kite');
const {loadFixture} = require('./helpers/fixtures');
const {parseParams} = require('./helpers/urls');

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

  describe('.isPathWhitelisted()', () => {
    withKite({logged: false}, () => {
      withKitePaths({}, 401);

      it('returns a rejected promise', () => {
        return waitsForPromise({shouldReject: true}, () =>
          KiteAPI.isPathWhitelisted('/path/to/dir'));
      });
    });

    withKite({logged: true}, () => {
      withKitePaths({
        whitelist: ['/path/to/dir'],
      });

      describe('called without a path', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.isPathWhitelisted());
        });
      });

      describe('passing a path not in the whitelist', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.isPathWhitelisted('/path/to/other/dir'));
        });
      });

      describe('passing a path in the whitelist', () => {
        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.isPathWhitelisted('/path/to/dir'));
        });
      });
    });
  });

  describe('.canWhitelistPath()', () => {
    withKite({logged: false}, () => {
      withKitePaths({}, 401);
      it('returns a rejected promise', () => {
        return waitsForPromise({shouldReject: true}, () =>
          KiteAPI.canWhitelistPath('/path/to/dir'));
      });
    });

    withKite({logged: true}, () => {
      withKitePaths({
        whitelist: ['/path/to/dir'],
      });
      describe('passing a path in the whitelist', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.canWhitelistPath('/path/to/dir'));
        });
      });

      describe('passing a path not in the whitelist', () => {
        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.canWhitelistPath('/path/to/other/dir'));
        });
      });
    });
  });

  describe('.whitelistPath()', () => {
    withKite({logged: false}, () => {
      withKitePaths({}, 401);
      it('returns a rejected promise', () => {
        return waitsForPromise({shouldReject: true}, () =>
          KiteAPI.whitelistPath('/path/to/dir'));
      });
    });

    withKite({logged: true}, () => {
      withKitePaths({
        whitelist: ['/path/to/dir'],
      });

      describe('passing a path in the whitelist', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.whitelistPath('/path/to/dir'));
        });
      });

      describe('passing a path not in the whitelist', () => {
        describe('and the request succeeds', () => {
          it('returns a resolving promise', () => {
            return waitsForPromise(() =>
            KiteAPI.whitelistPath('/path/to/other/dir'));
          });
        });

        describe('and the request fails', () => {
          withKiteRoutes([[
            o => /^\/clientapi\/permissions\/whitelist/.test(o.path),
            o => fakeResponse(500),
          ]]);
          it('returns a rejected promise', () => {
            return waitsForPromise({shouldReject: true}, () =>
              KiteAPI.whitelistPath('/path/to/other/dir'));
          });
        });
      });
    });
  });

  describe('.blacklistPath()', () => {
    withKite({logged: false}, () => {
      withKitePaths({}, 401);
      it('returns a rejected promise', () => {
        return waitsForPromise({shouldReject: true}, () =>
          KiteAPI.blacklistPath('/path/to/dir'));
      });
    });

    withKite({logged: true}, () => {
      withKitePaths({
        whitelist: ['/path/to/dir'],
      });
      describe('passing a path in the whitelist', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.blacklistPath('/path/to/dir'));
        });
      });

      describe('passing a path not in the whitelist', () => {
        describe('and the request succeeds', () => {
          it('returns a resolving promise', () => {
            return waitsForPromise(() =>
              KiteAPI.blacklistPath('/path/to/other/dir'));
          });
        });

        describe('and the request fails', () => {
          withKiteRoutes([[
            o => /^\/clientapi\/permissions\/blacklist/.test(o.path),
            o => fakeResponse(500),
          ]]);
          it('returns a rejected promise', () => {
            return waitsForPromise({shouldReject: true}, () =>
              KiteAPI.blacklistPath('/path/to/other/dir'));
          });
        });
      });
    });
  });

  withKite({logged: true}, () => {
    describe('.getSupportedLanguages()', () => {
      withKiteRoutes([[
        o => o.path === '/clientapi/languages',
        o => fakeResponse(200, JSON.stringify(['javascript', 'python'])),
      ]]);

      it('returns a promise that resolve with the supported languages', () => {
        return waitsForPromise(() => KiteAPI.getSupportedLanguages())
        .then(languages => {
          expect(languages).to.eql(['javascript', 'python']);
        });
      });
    });

    describe('.getHoverDataAtPosition()', () => {
      const source = loadFixture('sources/json-dump.py');
      const filename = '/path/to/json-dump.py';

      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/buffer\/atom/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned data', () => {
          return waitsForPromise(() =>
            KiteAPI.getHoverDataAtPosition(filename, source, 18))
          .then(data => {
            const editorHash = md5(source);
            const parsedURL = url.parse(KiteConnector.client.request.lastCall.args[0].path);

            expect(parsedURL.path.indexOf(filename.replace(/\//g, ':'))).not.to.eql(-1);
            expect(parsedURL.path.indexOf(editorHash)).not.to.eql(-1);

            const params = parseParams(parsedURL.query);

            expect(params.cursor_runes).to.eql('18');
            expect(data).to.eql({foo: 'bar'});
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/atom/.test(o.path),
            o => fakeResponse(404),
          ],
        ]);

        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.getHoverDataAtPosition(filename, source, 18));
        });
      });

    });

    describe('.getReportDataAtPosition()', () => {
      const source = loadFixture('sources/json-dump.py');
      const filename = '/path/to/json-dump.py';

      describe('when the hover request succeeds but not the report request', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/atom/.test(o.path),
            o => fakeResponse(200, JSON.stringify({
              symbol: [{
                id: 'foo',
                value: [],
              }],
            })),
          ], [
            o => /^\/api\/editor\/symbol/.test(o.path),
            o => fakeResponse(404),
          ],
        ]);

        it('returns a promise that resolve with the returned hover data', () => {
          return waitsForPromise(() => KiteAPI.getReportDataAtPosition(filename, source, 18))
          .then(data => {
            const editorHash = md5(source);
            const parsedURL = url.parse(KiteConnector.client.request.getCall(0).args[0].path);

            expect(parsedURL.path.indexOf(filename.replace(/\//g, ':'))).not.to.eql(-1);
            expect(parsedURL.path.indexOf(editorHash)).not.to.eql(-1);
            const params = parseParams(parsedURL.query);

            expect(params.cursor_runes).to.eql('18');
            expect(data).to.eql([{
              symbol: [{
                id: 'foo',
                value: [],
              }],
            }]);
          });
        });
      });

      describe('when both the hover request and the report request succeeds', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/atom/.test(o.path),
            o => fakeResponse(200, JSON.stringify({
              symbol: [{
                id: 'foo',
                value: [],
              }],
            })),
          ], [
            o => /^\/api\/editor\/symbol/.test(o.path),
            o => fakeResponse(200, '{"bar": "foo"}'),
          ],
        ]);

        it('returns a promise that resolve with both the returned report data', () => {
          return waitsForPromise(() => KiteAPI.getReportDataAtPosition(filename, source, 18))
          .then(data => {
            const parsedURL = url.parse(KiteConnector.client.request.lastCall.args[0].path);
            expect(parsedURL.path.indexOf('/foo')).not.to.eql(-1);

            expect(data).to.eql([
              {
                symbol: [{
                  id: 'foo',
                  value: [],
                }],
              },
            {bar: 'foo'},
            ]);
          });
        });
      });

      describe('when the hover request fails', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/atom/.test(o.path),
            o => fakeResponse(404),
          ],
        ]);

        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getReportDataAtPosition(filename, source, 18));
        });
      });
    });

    describe('.getValueReportDataForId()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned hover data', () => {
          return waitsForPromise(() => KiteAPI.getValueReportDataForId('foo'))
          .then(data => {
            const parsedURL = url.parse(KiteConnector.client.request.lastCall.args[0].path);

            expect(parsedURL.path.indexOf('/foo')).not.to.eql(-1);

            expect(data).to.eql({foo: 'bar'});
          });
        });

        describe('when the response value does not have an id', () => {
          withKiteRoutes([[
            o => /^\/api\/editor\/value/.test(o.path),
            o => fakeResponse(200, '{"foo": "bar", "value": {}}'),
          ]]);

          it('sets the value id using the provided one', () => {
            return waitsForPromise(() => KiteAPI.getValueReportDataForId('foo'))
            .then(data => {
              expect(data.value.id).to.eql('foo');
            });
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getValueReportDataForId('foo'));
        });
      });
    });

    describe('.getMembersDataForId()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value\/[^\/]+\/members/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned members data', () => {
          return waitsForPromise(() => KiteAPI.getMembersDataForId('foo'))
          .then(data => {
            const parsedURL = url.parse(KiteConnector.client.request.getCall(0).args[0].path);

            expect(parsedURL.path.indexOf('/foo')).not.to.eql(-1);

            expect(data).to.eql({foo: 'bar'});
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value\/[^\/]*\/members/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getMembersDataForId('foo'));
        });
      });
    });

    describe('.getUsagesDataForValueId()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value\/[^\/]+\/usages/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned members data', () => {
          return waitsForPromise(() => KiteAPI.getUsagesDataForValueId('foo'))
          .then(data => {
            const parsedURL = url.parse(KiteConnector.client.request.getCall(0).args[0].path);

            expect(parsedURL.path.indexOf('/foo')).not.to.eql(-1);

            expect(data).to.eql({foo: 'bar'});
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value\/[^\/]*\/usages/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getUsagesDataForValueId('foo'));
        });
      });
    });

    describe('.getUsageDataForId()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/usages/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned usage data', () => {
          return waitsForPromise(() => KiteAPI.getUsageDataForId('foo'))
          .then(data => {
            const parsedURL = url.parse(KiteConnector.client.request.getCall(0).args[0].path);

            expect(parsedURL.path.indexOf('/foo')).not.to.eql(-1);

            expect(data).to.eql({foo: 'bar'});
          });
        });

        describe('when the response value does not have an id', () => {
          withKiteRoutes([[
            o => /^\/api\/editor\/usages/.test(o.path),
            o => fakeResponse(200, '{"foo": "bar", "value": {}}'),
          ]]);

          it('sets the value id using the provided one', () => {
            return waitsForPromise(() => KiteAPI.getUsageDataForId('foo'))
            .then(data => {
              expect(data.value.id).to.eql('foo');
            });
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/usages/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getUsageDataForId('foo'));
        });
      });
    });

    describe('.getExampleDataForId()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/python\/curation/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned example data', () => {
          return waitsForPromise(() => KiteAPI.getExampleDataForId('foo'))
          .then(data => {
            const parsedURL = url.parse(KiteConnector.client.request.getCall(0).args[0].path);

            expect(parsedURL.path.indexOf('/foo')).not.to.eql(-1);

            expect(data).to.eql({foo: 'bar'});
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/python\/curation/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getExampleDataForId('foo'));
        });
      });
    });

    describe('.getUserAccountInfo()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/account\/user/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned example data', () => {
          return waitsForPromise(() => KiteAPI.getUserAccountInfo())
          .then(data => {
            expect(data).to.eql({foo: 'bar'});
          });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/account\/user/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({shouldReject: true}, () => KiteAPI.getUserAccountInfo());
        });
      });
    });

    describe('.isFileAuthorized()', () => {
      withKitePaths({
        whitelist: ['/path/to/dir'],
      });

      describe('when the file is in the whitelist', () => {
        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.isFileAuthorized('/path/to/dir/file.py'));
        });
      });

      describe('when the file is not in the whitelist', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.isFileAuthorized('/path/to/other/dir/file.py'));
        });
      });
    });

    describe('.shouldOfferWhitelist()', () => {
      withKitePaths({
        whitelist: ['/path/to/dir'],
        blacklist: ['/path/to/other/dir'],
        ignore: ['/path/to/ignored/dir'],
      });

      describe('for a path in the whitelist', () => {
        it('returns null', () => {
          return waitsForPromise(() => KiteAPI.shouldOfferWhitelist('/path/to/dir/file.py'))
          .then(res => {
            expect(res).to.eql(null);
          });
        });
      });

      describe('for a path in the blacklist', () => {
        it('returns null', () => {
          return waitsForPromise(() => KiteAPI.shouldOfferWhitelist('/path/to/other/dir/file.py'))
          .then(res => {
            expect(res).to.eql(null);
          });
        });
      });

      describe('for a path in the ignore list', () => {
        it('returns null', () => {
          return waitsForPromise(() => KiteAPI.shouldOfferWhitelist('/path/to/ignored/dir/file.py'))
          .then(res => {
            expect(res).to.eql(null);
          });
        });
      });

      describe('for a path not in the whitelist', () => {
        it('returns the preferred path to whitelist', () => {
          return waitsForPromise(() => KiteAPI.shouldOfferWhitelist('/path/to/some/file.py'))
          .then(res => {
            expect(res).to.eql('/path/to/some');
          });
        });
      });
    });
  });
});
