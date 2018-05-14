'use strict';

function merge(a, b) {
  const c = {};
  for (const k in a) { c[k] = a[k]; }
  for (const k in b) { c[k] = b[k]; }
  return c;
}

function reject(key, a) {
  const b = {};
  for (const k in a) {
    if (k !== key) { b[k] = a[k]; }
  }
  return b;
}

function checkArguments(...args) {
  if (!args.every(v => v)) { throw new Error('missing argument'); }
}

function checkArgumentKeys(arg, ...keys) {
  if (!keys.every(k => arg[k])) { throw new Error('missing mandatory key in argument'); }
}

module.exports = {
  checkArgumentKeys,
  checkArguments,
  merge,
  reject,
};
