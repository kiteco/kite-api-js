'use strict';

function parseParams(queryString) {
  return queryString
    ? queryString.split('&').map(p => p.split('=')).reduce((m, [k, v]) => {
      m[k] = v;
      return m;
    }, {})
    : {};
}

module.exports = {parseParams};
