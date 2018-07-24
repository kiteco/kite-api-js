'use strict';

const expect = require('expect.js');
const KiteConnector = require('kite-connector');
const {reject} = require('../../lib/utils');

function hasMandatoryArguments(invoke, args) {
  args.forEach((arg, i) => {
    describe(`with argument #${i + 1} missing`, () => {
      it('throws an exception', () => {
        expect(() => invoke(args.splice(0, i))).to.throwError();
      });
    });

    if (typeof arg == 'object' && Object.keys(arg).length) {
      Object.keys(arg).forEach(key => {
        const testArgs = args.concat();
        testArgs[i] = reject(key, arg);

        describe(`with argument #${i + 1}'s ${key} missing`, () => {
          it('throws an exception', () => {
            expect(() => invoke(testArgs)).to.throwError();
          });
        });
      });
    }
  });
}

function walkObject(object, callback, base = '') {
  Object.keys(object).forEach(key => {
    const value = object[key];
    if (typeof value == 'object') {
      walkObject(value, callback, `${key}.`);
    } else {
      callback(key, value, `${base}${key}`);
    }
  });
}

function walkPath(object, path) {
  path = path.split('.');
  return path.reduce((o, p) => {
    if (!o) { return o; }
    return o[p];
  }, object);
}

function sendsPayload(invoke, expectedPayload) {
  walkObject(expectedPayload, (key, value, keyPath) => {
    it(`sends ${JSON.stringify(value)} in payload at '${keyPath}'`, () => {
      invoke();
      const payload = JSON.parse(KiteConnector.client.request.lastCall.args[1]);
      const currentValue = walkPath(payload, keyPath);
      if (typeof value == 'function') {
        value(currentValue);
      } else {
        expect(currentValue).to.eql(value);        
      }
    });
  });
}

module.exports = {hasMandatoryArguments, sendsPayload};
