'use strict';

const expect = require('expect.js');

function hasMandatoryArguments(invoke, args) {
  args.forEach((arg, i) => {
    describe(`with argument #${i + 1} missing`, () => {
      it('throws an exception', () => {
        expect(() => invoke(args.splice(0, i))).to.throwError();
      });
    });
  });
}

module.exports = {hasMandatoryArguments};
