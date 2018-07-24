'use strict';

const fs = require('fs');
const sinon = require('sinon');
const expect = require('expect.js');
const {waitsForPromise} = require('kite-connector/test/helpers/async');

const FileStore = require('../../lib/stores/file');

describe('FileStore', () => {
  let store, file, readFileStub, writeFileStub;

  beforeEach(() => {
    store = new FileStore('/path/to/file');
    readFileStub = sinon.stub(fs, 'readFile').callsFake((path, callback) => {
      file instanceof Error
        ? callback(file)
        : callback(null, file);
    });
    writeFileStub = sinon.stub(fs, 'writeFile').callsFake((path, content, encoding, callback) => {
      if (file instanceof Error) {
        callback(file);
        return;
      }

      file = content;
      callback();
    });

    afterEach(() => {
      readFileStub.restore();
      writeFileStub.restore();
      file = undefined;
    });
  });

  describe('.set()', () => {
    it('sets the content of the file', () => {
      return waitsForPromise(() => store.set('foo'))
      .then(() => {
        expect(fs.writeFile.calledWith('/path/to/file', 'foo')).to.be.ok();
        expect(file).to.eql('foo');
      });
    });

    describe('when an error occurs', () => {
      it('returns a rejected promise', () => {
        file = new Error();
        return waitsForPromise({shouldReject: true}, () => store.set('foo'))
        .then(err => {
          expect(err).to.be(file);
        });
      });
    });
  });

  describe('.get()', () => {
    it('gets the content of the file', () => {
      file = 'foo';

      return waitsForPromise(() => store.get())
      .then(content => {
        expect(fs.readFile.calledWith('/path/to/file')).to.be.ok();
        expect(content).to.eql('foo');
      });
    });

    describe('when an error occurs', () => {
      it('returns a promise resolving to undefined', () => {
        file = new Error();
        return waitsForPromise(() => store.get())
        .then((content) => {
          expect(content).to.be(undefined);
        });
      });
    });
  });
});
