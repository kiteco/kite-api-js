'use strict';

const expect = require('expect.js');
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

module.exports = {hasMandatoryArguments};
