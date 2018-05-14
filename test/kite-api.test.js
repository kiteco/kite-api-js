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
const {merge} = require('../lib/utils');
const TestStore = require('./helpers/stores/test');
const {withKiteLogin, withKitePaths} = require('./helpers/kite');
const {loadFixture, getHugeSource} = require('./helpers/fixtures');
const {parseParams} = require('./helpers/urls');
const {hasMandatoryArguments, sendsPayload} = require('./helpers/arguments');

const mandatoryEditorMeta = {
  source: 'editor',
  plugin_version: 'some-version',
};

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
    hasMandatoryArguments((args) => KiteAPI.authenticateUser(...args), [
      'email', 'password',
    ]);

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
    hasMandatoryArguments((args) => KiteAPI.authenticateSessionID(...args), [
      'key',
    ]);

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
    hasMandatoryArguments((args) => KiteAPI.isPathWhitelisted(...args), [
      '/path/to/file.py',
    ]);

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
    hasMandatoryArguments((args) => KiteAPI.canWhitelistPath(...args), [
      '/path/to/file.py',
    ]);

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
    hasMandatoryArguments((args) => KiteAPI.whitelistPath(...args), [
      '/path/to/file.py',
    ]);

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
    hasMandatoryArguments((args) => KiteAPI.blacklistPath(...args), [
      '/path/to/file.py',
    ]);

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

      hasMandatoryArguments((args) => KiteAPI.getHoverDataAtPosition(...args), [
        filename, source, 18,
      ]);

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

      hasMandatoryArguments((args) => KiteAPI.getReportDataAtPosition(...args), [
        filename, source, 18,
      ]);

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
      hasMandatoryArguments((args) => KiteAPI.getValueReportDataForId(...args), [
        'id',
      ]);

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
      hasMandatoryArguments((args) => KiteAPI.getMembersDataForId(...args), [
        'id',
      ]);

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
      hasMandatoryArguments((args) => KiteAPI.getUsageDataForId(...args), [
        'id',
      ]);

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
      hasMandatoryArguments((args) => KiteAPI.getUsageDataForId(...args), [
        'id',
      ]);

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
      hasMandatoryArguments((args) => KiteAPI.getExampleDataForId(...args), [
        'id',
      ]);

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

      hasMandatoryArguments((args) => KiteAPI.isFileAuthorized(...args), [
        '/some/path/to/a/file.py',
      ]);

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

      hasMandatoryArguments((args) => KiteAPI.shouldOfferWhitelist(...args), [
        '/some/path/to/a/file.py',
      ]);

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

    describe('.getStatus()', () => {
      describe('when called without a filename', () => {
        it('returns a promise that resolves to a ready state', () => {
          return waitsForPromise(() => KiteAPI.getStatus())
          .then(status => {
            expect(status).to.eql({status: 'ready'});
          });
        });
      });

      describe('whenever the request fails', () => {
        withKiteRoutes([[
          o => /^\/clientapi\/status/.test(o.path),
          o => fakeResponse(403),
        ]]);
        it('returns a promise that resolves to a ready state', () => {
          return waitsForPromise(() => KiteAPI.getStatus('/path/to/dir/file.py'))
          .then(status => {
            expect(status).to.eql({status: 'ready'});
          });
        });
      });

      describe('when kited responds with a status', () => {
        withKiteRoutes([[
          o => /^\/clientapi\/status/.test(o.path),
          o => fakeResponse(200, '{"status": "indexing"}'),
        ]]);
        it('returns a promise that resolves to the received state', () => {
          return waitsForPromise(() => KiteAPI.getStatus('/path/to/dir/file.py'))
          .then(status => {
            expect(status).to.eql({status: 'indexing'});
          });
        });
      });
    });

    describe('.getCompletionsAtPosition()', () => {
      const source = loadFixture('sources/json-completions.py');
      const filename = '/path/to/json-completions.py';

      hasMandatoryArguments((args) => KiteAPI.getCompletionsAtPosition(...args), [
        filename, source, 1, 'editor',
      ]);

      sendsPayload(() => {
        KiteAPI.getCompletionsAtPosition(filename, source, 1, 'editor', );
      }, {
        text: source,
        editor: 'editor',
        filename,
        cursor_runes: 1,
      });

      describe('when there are completions returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/completions',
          o => fakeResponse(200, loadFixture('responses/json-completions.json')),
        ]]);

        it('returns a promise that resolves with the completions', () => {
          return waitsForPromise(() => KiteAPI.getCompletionsAtPosition(filename, source, 18, 'editor'))
          .then(completions => {
            expect(completions.length).to.eql(12);

            expect(completions[0].display).to.eql('dumps');
          });
        });
      });

      describe('when an error status is returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/completions',
          o => fakeResponse(404),
        ]]);

        it('returns a promise that resolves with an empty array', () => {
          return waitsForPromise(() => KiteAPI.getCompletionsAtPosition(filename, source, 18, 'editor'))
          .then(completions => {
            expect(completions.length).to.eql(0);
          });
        });
      });

      describe('when the provided file is too big', () => {
        it('returns a promise that resolves with an empty array without making the request', () => {
          return waitsForPromise(() => KiteAPI.getCompletionsAtPosition(filename, getHugeSource(), 18, 'editor'))
          .then(completions => {
            expect(completions.length).to.eql(0);

            expect(KiteConnector.client.request.called).not.to.be.ok();
          });
        });
      });
    });

    describe('.getSignaturesAtPosition()', () => {
      const source = loadFixture('sources/json-dump.py');
      const filename = '/path/to/json-dump.py';

      hasMandatoryArguments((args) => KiteAPI.getSignaturesAtPosition(...args), [
        filename, source, 1, 'editor',
      ]);

      sendsPayload(() => {
        KiteAPI.getSignaturesAtPosition(filename, source, 1, 'editor', );
      }, {
        text: source,
        editor: 'editor',
        filename,
        cursor_runes: 1,
      });

      describe('when there is a signature returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/signatures',
          o => fakeResponse(200, loadFixture('responses/json-dump-signature.json')),
        ]]);

        it('returns a promise that resolves with the completions', () => {
          return waitsForPromise(() => KiteAPI.getSignaturesAtPosition(filename, source, 18, 'editor'))
          .then(signature => {
            expect(signature).not.to.be(undefined);
          });
        });
      });

      describe('when an error status is returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/signatures',
          o => fakeResponse(404),
        ]]);

        it('returns a promise that resolves with undefined', () => {
          return waitsForPromise(() => KiteAPI.getSignaturesAtPosition(filename, source, 18, 'editor'))
          .then(signature => {
            expect(signature).to.be(undefined);
          });
        });
      });

      describe('when the provided file is too big', () => {
        it('returns a promise that resolves with undefined without making the request', () => {
          return waitsForPromise(() => KiteAPI.getSignaturesAtPosition(filename, getHugeSource(), 18, 'editor'))
          .then(signature => {
            expect(signature).to.be(undefined);

            expect(KiteConnector.client.request.called).not.to.be.ok();
          });
        });
      });
    });

    describe('.getAutocorrectData()', () => {
      const source = loadFixture('sources/errored.py');
      const filename = '/path/to/errored.py';

      hasMandatoryArguments((args) => KiteAPI.getAutocorrectData(...args), [
        filename, source, mandatoryEditorMeta,
      ]);

      sendsPayload(() => {
        KiteAPI.getAutocorrectData(filename, source, mandatoryEditorMeta);
      }, {
        metadata: merge({
          event: 'autocorrect_request',
          os_name: KiteAPI.getOsName(),
        }, mandatoryEditorMeta),
        buffer: source,
        filename,
        language: 'python',
      });

      describe('when there is a fix to make in the file', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect',
          o => fakeResponse(200, loadFixture('responses/autocorrect-with-fixes.json')),
        ]]);

        it('returns a promise that resolves with the autocorrect data', () => {
          return waitsForPromise(() => KiteAPI.getAutocorrectData(filename, source, mandatoryEditorMeta))
          .then(autocorrect => {
            expect(autocorrect).not.to.be(undefined);
          });
        });
      });

      describe('when the endpoint replies with an error', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect',
          o => fakeResponse(500),
        ]]);

        it('returns a promise that resolves with undefined', () => {
          return waitsForPromise(() => KiteAPI.getAutocorrectData(filename, source, mandatoryEditorMeta))
          .then(autocorrect => {
            expect(autocorrect).to.be(undefined);
          });
        });
      });

      describe('when the provided file is too big', () => {
        it('returns a promise that resolves with undefined without making the request', () => {
          return waitsForPromise(() => KiteAPI.getAutocorrectData(filename, getHugeSource(), mandatoryEditorMeta))
          .then(autocorrect => {
            expect(autocorrect).to.be(undefined);

            expect(KiteConnector.client.request.called).not.to.be.ok();
          });
        });
      });
    });

    describe('.getAutocorrectModelInfo()', () => {
      hasMandatoryArguments((args) => KiteAPI.getAutocorrectModelInfo(...args), [
        'version', mandatoryEditorMeta,
      ]);

      sendsPayload(() => {
        KiteAPI.getAutocorrectModelInfo('version', mandatoryEditorMeta);
      }, {
        metadata: merge({
          event: 'model_info_request',
          os_name: KiteAPI.getOsName(),
        }, mandatoryEditorMeta),
        version: 'version',
        language: 'python',
      });

      describe('when there is model info in the response', () => {
        withKiteRoutes([[
          o => o.path === '/api/editor/autocorrect/model-info',
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolves with the data', () => {
          return waitsForPromise(() => KiteAPI.getAutocorrectModelInfo('version', mandatoryEditorMeta))
          .then(autocorrect => {
            expect(autocorrect).not.to.be({foo: 'bar'});
          });
        });
      });

      describe('when the endpoint replies with an error', () => {
        withKiteRoutes([[
          o => o.path === '/api/editor/autocorrect/model-info',
          o => fakeResponse(500),
        ]]);

        it('returns a promise that resolves with undefined', () => {
          return waitsForPromise(() => KiteAPI.getAutocorrectModelInfo('version', mandatoryEditorMeta))
          .then(autocorrect => {
            expect(autocorrect).to.be(undefined);
          });
        });
      });
    });

    describe('.postSaveValidationData()', () => {
      const source = loadFixture('sources/errored.py');
      const filename = '/path/to/errored.py';

      hasMandatoryArguments((args) => KiteAPI.postSaveValidationData(...args), [
        filename, source, mandatoryEditorMeta,
      ]);

      sendsPayload(() => {
        KiteAPI.postSaveValidationData(filename, source, mandatoryEditorMeta);
      }, {
        metadata: merge({
          event: 'validation_onsave',
          os_name: KiteAPI.getOsName(),
        }, mandatoryEditorMeta),
        buffer: source,
        filename,
        language: 'python',
      });

      describe('when the endpoint respond with 200', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect/validation/on-save',
          o => fakeResponse(200),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() => KiteAPI.postSaveValidationData(filename, source, mandatoryEditorMeta));
        });
      });

      describe('when the endpoint replies with an error', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect/validation/on-save',
          o => fakeResponse(500),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() => KiteAPI.postSaveValidationData(filename, source, mandatoryEditorMeta));
        });
      });

      describe('when the provided file is too big', () => {
        it('returns a promise that resolves without making the request', () => {
          return waitsForPromise(() => KiteAPI.postSaveValidationData(filename, getHugeSource(), mandatoryEditorMeta))
          .then(autocorrect => {
            expect(KiteConnector.client.request.called).not.to.be.ok();
          });
        });
      });
    });

    describe('.postAutocorrectFeedbackData()', () => {
      const response = '{"foo": "bar"}';

      hasMandatoryArguments((args) => KiteAPI.postAutocorrectFeedbackData(...args), [
        response, 1, mandatoryEditorMeta,
      ]);

      sendsPayload(() => {
        KiteAPI.postAutocorrectFeedbackData(response, -1, mandatoryEditorMeta);
      }, {
        metadata: merge({
          event: 'feedback_diffset',
          os_name: KiteAPI.getOsName(),
        }, mandatoryEditorMeta),
        response,
        feedback: -1,
      });

      describe('when the endpoint respond with 200', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect/feedback',
          o => fakeResponse(200),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() => KiteAPI.postAutocorrectFeedbackData(response, 1, mandatoryEditorMeta));
        });
      });

      describe('when the endpoint replies with an error', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect/feedback',
          o => fakeResponse(500),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() => KiteAPI.postAutocorrectFeedbackData(response, 1, mandatoryEditorMeta));
        });
      });
    });

    describe('.postAutocorrectHashMismatchData()', () => {
      const response = '{"foo": "bar"}';
      const date = new Date();

      hasMandatoryArguments((args) => KiteAPI.postAutocorrectHashMismatchData(...args), [
        response, date, mandatoryEditorMeta,
      ]);

      sendsPayload(() => {
        KiteAPI.postAutocorrectHashMismatchData(response, date, mandatoryEditorMeta);
      }, {
        metadata: merge({
          event: 'metrics_hash_mismatch',
          os_name: KiteAPI.getOsName(),
        }, mandatoryEditorMeta),
        response,
        response_time: value => expect(value).not.to.be(null),
      });

      describe('when the endpoint respond with 200', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect/metrics',
          o => fakeResponse(200),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.postAutocorrectHashMismatchData(response, date, mandatoryEditorMeta));
        });
      });

      describe('when the endpoint replies with an error', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/autocorrect/metrics',
          o => fakeResponse(500),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.postAutocorrectHashMismatchData(response, date, mandatoryEditorMeta));
        });
      });
    });

    describe('.sendFeatureMetric()', () => {
      const name = 'feature_metric_name';

      hasMandatoryArguments((args) => KiteAPI.sendFeatureMetric(...args), [name]);

      sendsPayload(() => {
        KiteAPI.sendFeatureMetric(name).catch(err => {});
      }, {
        name,
        value: 1,
      });

      describe('when the endpoint respond with 200', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/metrics/counters',
          o => fakeResponse(200),
        ]]);

        it('returns a resolving promise', () => {
          return waitsForPromise(() =>
            KiteAPI.sendFeatureMetric(name));
        });
      });

      describe('when the endpoint replies with an error', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/metrics/counters',
          o => fakeResponse(500),
        ]]);

        it('returns a rejected promise', () => {
          return waitsForPromise({shouldReject: true}, () =>
            KiteAPI.sendFeatureMetric(name));
        });
      });
    });

    describe('.featureRequested()', () => {
      const name = 'metric';
      const editor = 'editor';

      withKiteRoutes([[
        o => o.path === '/clientapi/metrics/counters',
        o => fakeResponse(200),
      ]]);

      hasMandatoryArguments((args) => KiteAPI.featureRequested(...args), [name, editor]);

      sendsPayload(() => {
        KiteAPI.featureRequested(name, editor);
      }, {
        name: 'editor_metric_requested',
        value: 1,
      });

      it('proxies to sendFeatureMetric', () => {
        const stub = sinon.stub(KiteAPI, 'sendFeatureMetric');
        KiteAPI.featureRequested(name, editor);
        expect(KiteAPI.sendFeatureMetric.called).to.be.ok();
        stub.restore();
      });
    });

    describe('.featureFulfilled()', () => {
      const name = 'metric';
      const editor = 'editor';

      withKiteRoutes([[
        o => o.path === '/clientapi/metrics/counters',
        o => fakeResponse(200),
      ]]);

      hasMandatoryArguments((args) => KiteAPI.featureFulfilled(...args), [name, editor]);

      sendsPayload(() => {
        KiteAPI.featureFulfilled(name, editor);
      }, {
        name: 'editor_metric_fulfilled',
        value: 1,
      });

      it('proxies to sendFeatureMetric', () => {
        const stub = sinon.stub(KiteAPI, 'sendFeatureMetric');
        KiteAPI.featureFulfilled(name, editor);
        expect(KiteAPI.sendFeatureMetric.called).to.be.ok();
        stub.restore();
      });
    });

    describe('.featureApplied()', () => {
      const name = 'metric';
      const editor = 'editor';

      withKiteRoutes([[
        o => o.path === '/clientapi/metrics/counters',
        o => fakeResponse(200),
      ]]);

      hasMandatoryArguments((args) => KiteAPI.featureApplied(...args), [name, editor]);

      sendsPayload(() => {
        KiteAPI.featureApplied(name, editor, '_suffix');
      }, {
        name: 'editor_metric_applied_suffix',
        value: 1,
      });

      it('proxies to sendFeatureMetric', () => {
        const stub = sinon.stub(KiteAPI, 'sendFeatureMetric');
        KiteAPI.featureApplied(name, editor);
        expect(KiteAPI.sendFeatureMetric.called).to.be.ok();
        stub.restore();
      });
    });
  });
});
