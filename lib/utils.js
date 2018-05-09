'use strict';

function merge(a, b) {
  const c = {};
  for (const k in a) { c[k] = a[k]; }
  for (const k in b) { c[k] = b[k]; }
  return c;
}

function checkArguments(...args) {
  if (!args.every(v => v)) { throw new Error('missing argument'); }
}

module.exports = {
  checkArguments,
  merge,
};
