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

function parseSignature(fn) {
  const [, name, signature] = /(\w+)\(([^\)]+)\)/.exec(fn.toString());
  const parameters = signature.split(/,\s*/);
  return [name, parameters];
}

function checkArguments(fn, ...args) {
  const [name, parameters] = parseSignature(fn);
  const missingArguments = [];
  args.forEach((arg, i) => {
    if (arg == null) { missingArguments.push(parameters[i]); }
  });
  if (missingArguments.length) {
    throw new Error(
      `Missing argument${missingArguments.length > 1 ? 's' : ''} ${missingArguments.join(', ')} in ${name}`);
  }
}

function checkArgumentKeys(fn, arg, argName, ...keys) {
  const missingKeys = [];
  keys.forEach((key, i) => {
    if (arg[key] == null) { missingKeys.push(key); }
  });
  if (missingKeys.length) {
    throw new Error(
      `Missing mandatory key${
        missingKeys.length > 1 ? 's' : ''
      } ${missingKeys.join(', ')} in argument ${argName} of ${fn.name}`);
  }
}

module.exports = {
  checkArgumentKeys,
  checkArguments,
  merge,
  reject,
};
