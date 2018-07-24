'use strict';

const expect = require('expect.js');
const {waitsForPromise} = require('kite-connector/test/helpers/async');
const EditorConfig = require('../lib/editor-config');
const MemoryStore = require('../lib/stores/memory');

describe('EditorConfig', () => {
  let editorConfig, store;

  beforeEach(() => {
    store = new MemoryStore();
    editorConfig = new EditorConfig(store);
  });

  describe('.get()', () => {
    describe('when there is no data in the store yet', () => {
      it('returns a promise that resolves to undefined', () => {
        return waitsForPromise(() => editorConfig.get('path.to.key'))
        .then(value => {
          expect(value).to.be(undefined);
        });
      });
    });

    describe('when there is data in the store', () => {
      beforeEach(() => {
        store.set(JSON.stringify({
          path: {
            to: {
              key : 'foo',
            },
          },
        }));
      });

      it('returns a promise that resolves to the value for a valid path', () => {
        return waitsForPromise(() => editorConfig.get('path.to.key')).then(value => {
          expect(value).to.eql('foo');
        });
      });

      it('returns a promise that resolves to undefined when the path leads nowhere', () => {
        return waitsForPromise(() => editorConfig.get('path.to.non.existent.key')).then(value => {
          expect(value).to.be(undefined);
        });
      });
    });
  });

  describe('.set()', () => {
    describe('when there is no data in the store yet', () => {
      it('writes the data in the store', () => {
        return waitsForPromise(() => editorConfig.set('path.to.key', 'foo'))
        .then(() => {
          expect(store.content).to.eql(JSON.stringify({
            path: {
              to: {
                key : 'foo',
              },
            },
          }));
        });
      });
    });

    describe('when there is data in the store', () => {
      beforeEach(() => {
        store.set(JSON.stringify({
          path: {
            to: {
              key : 'foo',
            },
          },
        }));
      });

      it('writes the new data in the store', () => {
        return waitsForPromise(() => editorConfig.set('path.to.non.existent.key', 'bar'))
        .then(() => {
          expect(store.content).to.eql(JSON.stringify({
            path: {
              to: {
                key : 'foo',
                non: {
                  existent: {
                    key: 'bar',
                  },
                },
              },
            },
          }));
        });
      });
    });
  });
});
