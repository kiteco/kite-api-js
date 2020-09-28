'use strict';

const url = require('url');
const md5 = require('md5');
const http = require('http');
const https = require('https');
const sinon = require('sinon');
const expect = require('expect.js');
const KiteConnector = require('kite-connector');
const { waitsForPromise } = require('kite-connector/test/helpers/async');
const { fakeResponse } = require('kite-connector/test/helpers/http');

const KiteAPI = require('../lib');
const { merge } = require('../lib/utils');
const MemoryStore = require('../lib/stores/memory');
const { withKite, withKiteRoutes, withKiteAccountRoutes } = require('./helpers/kite');
const { loadFixture } = require('./helpers/fixtures');
const { parseParams } = require('./helpers/urls');
const { hasMandatoryArguments, sendsPayload } = require('./helpers/arguments');

const mandatoryEditorMeta = {
  source: 'editor',
  plugin_version: 'some-version',
};

describe('KiteAPI', () => {
  beforeEach(() => {
    KiteAPI.editorConfig.store = new MemoryStore();
  });

  [
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
    'onDidFailRequest',
    'request',
    'runKiteWithCopilot',
    'runKite',
    'runKiteAndWait',
    'runKiteEnterprise',
    'runKiteEnterpriseAndWait',
    'toggleRequestDebug',
    'waitForKite',
  ].forEach(method => {
    it(`delegates calls to ${method} to the connector`, () => {
      const stub = sinon.stub(KiteConnector, method).callsFake(() => { });
      KiteAPI[method]('foo', 'bar');
      expect(KiteConnector[method].calledWith('foo', 'bar')).to.be.ok();
      stub.restore();
    });
  });

  describe('.isKiteLocal()', () => {
    it('returns a boolean resolving promise', () => {
      return KiteAPI.isKiteLocal().then((isLocal) => {
        expect(isLocal).to.be.a('boolean');
      });
    });
  });

  withKite({ reachable: true }, () => {
    describe('.getMaxFileSizeBytes()', () => {
      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/settings/max_file_size_kb',
          o => fakeResponse(200, 75),
        ]]);

        it('returns a promise that resolves with the max file size in bytes', () => {
          return waitsForPromise(() => KiteAPI.getMaxFileSizeBytes())
            .then(res => {
              expect(res).to.eql(76800);
            });
        });
      });
      describe('when the request fails', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/settings/max_file_size_kb',
          o => fakeResponse(400),
        ]]);

        it('returns a promise that resolves with the default max file size in bytes', () => {
          return waitsForPromise(() => KiteAPI.getMaxFileSizeBytes())
            .then(res => {
              expect(res).to.eql(KiteAPI.DEFAULT_MAX_FILE_SIZE);
            });
        });
      });
    });

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

    describe('.getOnboardingFilePath()', () => {
      const editor = 'editor';
      hasMandatoryArguments((args) => KiteAPI.getOnboardingFilePath(...args), [
        editor,
      ]);

      withKiteRoutes([[
        o => /^\/clientapi\/plugins\/onboarding_file\?editor=editor&language=python/.test(o.path),
        o => fakeResponse(200, JSON.stringify('/path/to/onboarding_file.py')),
      ]]);

      it('returns a promise that resolves with an onboarding file path', () => {
        return waitsForPromise(() => KiteAPI.getOnboardingFilePath(editor))
          .then(path => {
            expect(path).to.equal('/path/to/onboarding_file.py');
          });
      });
    });

    describe('.getHoverDataAtPosition()', () => {
      const source = loadFixture('sources/json-dump.py');
      const filename = '/path/to/json-dump.py';

      hasMandatoryArguments((args) => KiteAPI.getHoverDataAtPosition(...args), [
        filename, source, 18, 'editor',
      ]);

      describe('when the request succeeds', () => {
        withKiteRoutes([[
          o => /^\/api\/buffer\/editor/.test(o.path),
          o => fakeResponse(200, '{"foo": "bar"}'),
        ]]);

        it('returns a promise that resolve with the returned data', () => {
          return waitsForPromise(() =>
            KiteAPI.getHoverDataAtPosition(filename, source, 18, 'editor', 'utf-16'))
            .then(data => {
              const editorHash = md5(source);
              const parsedURL = url.parse(KiteConnector.client.request.lastCall.args[0].path);

              expect(parsedURL.path.indexOf(filename.replace(/\//g, ':'))).not.to.eql(-1);
              expect(parsedURL.path.indexOf(editorHash)).not.to.eql(-1);
              expect(parsedURL.path.indexOf('/editor/')).not.to.eql(-1);

              const params = parseParams(parsedURL.query);

              expect(params.cursor_runes).to.eql('18');
              expect(params.offset_encoding).to.eql('utf-16');
              expect(data).to.eql({ foo: 'bar' });
            });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/editor/.test(o.path),
            o => fakeResponse(404),
          ],
        ]);

        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () =>
            KiteAPI.getHoverDataAtPosition(filename, source, 18, 'editor', 'utf-16'));
        });
      });

    });

    describe('.getReportDataAtPosition()', () => {
      const source = loadFixture('sources/json-dump.py');
      const filename = '/path/to/json-dump.py';

      hasMandatoryArguments((args) => KiteAPI.getReportDataAtPosition(...args), [
        filename, source, 18, 'editor',
      ]);

      describe('when the hover request succeeds but not the report request', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/editor/.test(o.path),
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
          return waitsForPromise(() => KiteAPI.getReportDataAtPosition(filename, source, 18, 'editor', 'utf-16'))
            .then(data => {
              const editorHash = md5(source);
              const parsedURL = url.parse(KiteConnector.client.request.getCall(0).args[0].path);

              expect(parsedURL.path.indexOf(filename.replace(/\//g, ':'))).not.to.eql(-1);
              expect(parsedURL.path.indexOf(editorHash)).not.to.eql(-1);
              const params = parseParams(parsedURL.query);

              expect(params.cursor_runes).to.eql('18');
              expect(params.offset_encoding).to.eql('utf-16');
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
            o => /^\/api\/buffer\/editor/.test(o.path),
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
          return waitsForPromise(() => KiteAPI.getReportDataAtPosition(filename, source, 18, 'editor', 'utf-16'))
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
                { bar: 'foo' },
              ]);
            });
        });
      });

      describe('when the hover request fails', () => {
        withKiteRoutes([
          [
            o => /^\/api\/buffer\/editor/.test(o.path),
            o => fakeResponse(404),
          ],
        ]);

        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getReportDataAtPosition(filename, source, 18, 'editor', 'utf-16'));
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

              expect(data).to.eql({ foo: 'bar' });
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
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getValueReportDataForId('foo'));
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

              expect(data).to.eql({ foo: 'bar' });
            });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value\/[^\/]*\/members/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getMembersDataForId('foo'));
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

              expect(data).to.eql({ foo: 'bar' });
            });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/editor\/value\/[^\/]*\/usages/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getUsagesDataForValueId('foo'));
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

              expect(data).to.eql({ foo: 'bar' });
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
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getUsageDataForId('foo'));
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

              expect(data).to.eql({ foo: 'bar' });
            });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/python\/curation/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getExampleDataForId('foo'));
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
              expect(data).to.eql({ foo: 'bar' });
            });
        });
      });

      describe('when the request fails', () => {
        withKiteRoutes([[
          o => /^\/api\/account\/user/.test(o.path),
          o => fakeResponse(404),
        ]]);

        it('returns a promise that is rejected', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.getUserAccountInfo());
        });
      });
    });

    describe('.getStatus()', () => {
      describe('when called without a filename', () => {
        it('returns a promise that resolves to a ready state', () => {
          return waitsForPromise(() => KiteAPI.getStatus())
            .then(status => {
              expect(status).to.eql({ status: 'ready' });
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
              expect(status).to.eql({ status: 'ready' });
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
              expect(status).to.eql({ status: 'indexing' });
            });
        });
      });
    });

    describe('.getCompletions()', () => {
      const source = loadFixture('sources/json-completions.py');
      const filename = '/path/to/json-completions.py';

      const payload = {
        text: source,
        editor: 'editor',
        filename,
        position: {
          begin: 17,
          end: 17,
        },
        offset_encoding: 'utf-16',
      };

      hasMandatoryArguments((args) => KiteAPI.getCompletions(...args), [{}]);

      sendsPayload(() => { KiteAPI.getCompletions(payload); }, payload);

      describe('when there are completions returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/complete',
          o => fakeResponse(200, loadFixture('responses/json-snippet-completions.json')),
        ]]);

        it('returns a promise that resolves with the completions', () => {
          return waitsForPromise(() => KiteAPI.getCompletions(payload))
            .then(completions => {
              expect(completions.length).to.eql(11);
              expect(completions[0].display).to.eql('JSONEncoder');
            });
        });
      });

      describe('when an error status is returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/complete',
          o => fakeResponse(404),
        ]]);

        it('returns a promise that resolves with an empty array', () => {
          return waitsForPromise(() => KiteAPI.getCompletions(payload))
            .then(completions => {
              expect(completions.length).to.eql(0);
            });
        });
      });
    });

    describe('.getSignaturesAtPosition()', () => {
      const source = loadFixture('sources/json-dump.py');
      const filename = '/path/to/json-dump.py';

      hasMandatoryArguments((args) => KiteAPI.getSignaturesAtPosition(...args), [
        filename, source, 1, 'editor', 'utf-16',
      ]);

      sendsPayload(() => {
        KiteAPI.getSignaturesAtPosition(filename, source, 1, 'editor', 'utf-16');
      }, {
        text: source,
        editor: 'editor',
        filename,
        cursor_runes: 1,
        offset_encoding: 'utf-16',
      });

      describe('when there is a signature returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/editor/signatures',
          o => fakeResponse(200, loadFixture('responses/json-dump-signature.json')),
        ]]);

        it('returns a promise that resolves with the completions', () => {
          return waitsForPromise(() => KiteAPI.getSignaturesAtPosition(filename, source, 18, 'editor', 'utf-16'))
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
          return waitsForPromise(() => KiteAPI.getSignaturesAtPosition(filename, source, 18, 'editor', 'utf-16'))
            .then(signature => {
              expect(signature).to.be(undefined);
            });
        });
      });
    });

    describe('.getKSGCompletions()', () => {

      describe('when there is a KSG completions response to be returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/ksg/completions?query=fake',
          o => fakeResponse(200, loadFixture('responses/ksg-completions.json')), //TODO: need to create fixture
        ]]);

        it('returns a promise that resolves with KSG completions', () => {
          return waitsForPromise(() => KiteAPI.getKSGCompletions('fake'))
            .then(completions => {
              expect(completions).not.to.be(undefined);
            });
        });
      });

      describe('when an error status is returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/ksg/completions?query=fake',
          o => fakeResponse(404),
        ]]);

        it('returns a promise that resolves with undefined', () => {
          return waitsForPromise(() => KiteAPI.getKSGCompletions('fake'))
            .then(completions => {
              expect(completions).to.be(undefined);
            });
        });
      });
    });

    describe('.getKSGCodeBlocks()', () => {

      describe('when there is a KSG Code Block response to be returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/ksg/codeblocks?query=fake&results=3',
          o => fakeResponse(200, loadFixture('responses/ksg-codeblocks.json')), //TODO: need to create fixture
        ]]);

        it('returns a promise that resolves with KSG Code Blocks', () => {
          return waitsForPromise(() => KiteAPI.getKSGCodeBlocks('fake'))
            .then(completions => {
              expect(completions).not.to.be(undefined);
            });
        });
      });

      describe('when an error status is returned by kited', () => {
        withKiteRoutes([[
          o => o.path === '/clientapi/ksg/codeblocks?query=fake&results=3',
          o => fakeResponse(404),
        ]]);

        it('returns a promise that resolves with undefined', () => {
          return waitsForPromise(() => KiteAPI.getKSGCodeBlocks('fake'))
            .then(completions => {
              expect(completions).to.be(undefined);
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
              expect(autocorrect).not.to.be({ foo: 'bar' });
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
        KiteAPI.sendFeatureMetric(name).catch(err => { });
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
          return waitsForPromise({ shouldReject: true }, () =>
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


  describe('.Account', () => {
    describe('.initClient()', () => {
      it('properly passes protocol to the client', () => {
        KiteAPI.Account.initClient('foo.com', 80, 'foo');

        expect(KiteAPI.Account.client.hostname).to.eql('foo.com');
        expect(KiteAPI.Account.client.port).to.eql(80);
        expect(KiteAPI.Account.client.base).to.eql('foo');
        expect(KiteAPI.Account.client.protocol).to.eql(http);

        KiteAPI.Account.initClient('bar.com', 120, 'bar', true);

        expect(KiteAPI.Account.client.hostname).to.eql('bar.com');
        expect(KiteAPI.Account.client.port).to.eql(120);
        expect(KiteAPI.Account.client.base).to.eql('bar');
        expect(KiteAPI.Account.client.protocol).to.eql(https);
      });
    });

    describe('.toggleRequestDebug()', () => {
      it('properly passes protocol to the client', () => {
        KiteAPI.Account.initClient('foo.com', 80, 'foo', true);

        KiteAPI.Account.toggleRequestDebug();

        expect(KiteAPI.Account.client.hostname).to.eql('foo.com');
        expect(KiteAPI.Account.client.port).to.eql(80);
        expect(KiteAPI.Account.client.base).to.eql('foo');
        expect(KiteAPI.Account.client.protocol).to.eql('https');

        KiteAPI.Account.toggleRequestDebug();

        expect(KiteAPI.Account.client.hostname).to.eql('foo.com');
        expect(KiteAPI.Account.client.port).to.eql(80);
        expect(KiteAPI.Account.client.base).to.eql('foo');
        expect(KiteAPI.Account.client.protocol).to.eql(https);
      });
    });

    describe('.checkEmail()', () => {
      describe('when the request succeeds', () => {
        withKiteAccountRoutes([[
          o => /\/api\/account\/check-email/.test(o.path),
          o => fakeResponse(200),
        ]], () => {
          it('returns a promise that is resolved after calling the endpoint', () => {
            return waitsForPromise(() => KiteAPI.Account.checkEmail({
              email: 'foo@bar.com',
            }));
          });
        });
      });

      describe('when called without an email', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.checkEmail({}));
        });
      });

      describe('when called without any data', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.checkEmail());
        });
      });

      describe('when the request fails', () => {
        withKiteAccountRoutes([], () => {
          it('returns a rejected promise', () => {
            return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.checkEmail({
              email: 'foo@bar.com',
            }));
          });
        });
      });
    });

    describe('.createAccount()', () => {
      describe('when the request succeeds', () => {
        withKiteAccountRoutes([[
          o => /\/api\/account\/createPasswordless/.test(o.path),
          o => fakeResponse(200),
        ]], () => {
          it('returns a promise that is resolved after calling the endpoint', () => {
            return waitsForPromise(() => KiteAPI.Account.createAccount({
              email: 'foo@bar.com',
            }));
          });

          it('calls the provided callback', () => {
            const spy = sinon.spy();
            return waitsForPromise(() => KiteAPI.Account.createAccount({
              email: 'foo@bar.com',
            }, spy))
              .then(() => {
                expect(spy.called).to.be.ok();
              });
          });
        });
      });


      describe('when called with a password', () => {
        withKiteAccountRoutes([[
          o => /\/api\/account\/create$/.test(o.path),
          o => fakeResponse(200),
        ]], () => {
          it('returns a promise that is resolved after calling the endpoint', () => {
            return waitsForPromise(() => KiteAPI.Account.createAccount({
              email: 'foo@bar.com',
              password: 'foobarbaz',
            }));
          });

          it('calls the provided callback', () => {
            const spy = sinon.spy();
            return waitsForPromise(() => KiteAPI.Account.createAccount({
              email: 'foo@bar.com',
              password: 'foobarbaz',
            }, spy).then(() => {
              expect(spy.called).to.be.ok();
            }));
          });
        });
      });

      describe('when called without an email', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.createAccount({}));
        });
      });

      describe('when called without any data', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.createAccount());
        });
      });

      describe('when the request fails', () => {
        withKiteAccountRoutes([], () => {
          it('returns a rejected promise', () => {
            return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.createAccount({
              email: 'foo@bar.com',
            }));
          });
        });
      });
    });

    describe('.login()', () => {
      describe('when the request succeeds', () => {
        withKiteAccountRoutes([[
          o => /\/api\/account\/login/.test(o.path),
          o => fakeResponse(200),
        ]], () => {
          it('returns a promise that is resolved after calling the endpoint', () => {
            return waitsForPromise(() => KiteAPI.Account.login({
              email: 'foo@bar.com',
              password: 'foo',
            }));
          });

          it('calls the provided callback', () => {
            const spy = sinon.spy();
            return waitsForPromise(() => KiteAPI.Account.login({
              email: 'foo@bar.com',
              password: 'foo',
            }, spy).then(() => {
              expect(spy.called).to.be.ok();
            }));
          });
        });
      });

      describe('when called without an email', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () =>
            KiteAPI.Account.login({
              password: 'foo',
            }));
        });
      });

      describe('when called without a password', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () =>
            KiteAPI.Account.login({
              email: 'foo@bar.com',
            }));
        });
      });

      describe('when called without any data', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.login());
        });
      });

      describe('when the request fails', () => {
        withKiteAccountRoutes([], () => {
          it('returns a rejected promise', () => {
            return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.login({
              email: 'foo@bar.com',
              password: 'foo',
            }));
          });
        });
      });
    });

    describe('.resetPassword()', () => {
      describe('when the request succeeds', () => {
        withKiteAccountRoutes([[
          o => /\/api\/account\/reset-password\/request/.test(o.path),
          o => fakeResponse(200),
        ]], () => {
          it('returns a promise that is resolved after calling the endpoint', () => {
            return waitsForPromise(() => KiteAPI.Account.resetPassword({
              email: 'foo@bar.com',
            }));
          });

          it('calls the provided callback', () => {
            const spy = sinon.spy();
            return waitsForPromise(() => KiteAPI.Account.resetPassword({
              email: 'foo@bar.com',
            }, spy))
              .then(() => {
                expect(spy.called).to.be.ok();
              });
          });
        });
      });

      describe('when called without an email', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.resetPassword({}));
        });
      });

      describe('when called without any data', () => {
        it('returns a rejected promise', () => {
          return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.resetPassword());
        });
      });

      describe('when the request fails', () => {
        withKiteAccountRoutes([], () => {
          it('returns a rejected promise', () => {
            return waitsForPromise({ shouldReject: true }, () => KiteAPI.Account.resetPassword({
              email: 'foo@bar.com',
            }));
          });
        });
      });
    });
  });
});
