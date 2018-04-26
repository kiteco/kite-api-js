'use strict';

module.exports = class EditorConfig {
  constructor(store) {
    this.store = store;
  }

  get(path) {
    return (this.content
      ? Promise.resolve(this.content)
      : this.store.get()
        .then(data => parse(data))
        .then(data => {
          this.content = data;
          return data;
        }))
    .then(data => readValueAtPath(path, data));
  }

  set(path, value) {
    return this.get().then(data =>
      this.store.set(stringify(writeValueAtPath(path, value, data))));
  }
};

function parse(data) {
  return data ? JSON.parse(data) : data;
}

function stringify(data) {
  return JSON.stringify(data);
}

function readValueAtPath(path, object) {
  if (!path) { return object; }

  return path.split(/\./g).reduce((memo, key) => {
    if (memo == undefined) { return memo; }
    return memo[key];
  }, object);
}

function writeValueAtPath(path, value, object) {
  if (!object) { object = {}; }

  return path.split(/\./g).reduce((memo, key, i, a) => {
    if (i === a.length - 1) {
      memo[key] = value;
      return object;
    } else if (memo[key] == undefined) {
      memo[key] = {};
      return memo[key];
    }
    return memo[key];
  }, object);
}
