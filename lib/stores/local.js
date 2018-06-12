'use strict';

module.exports = class LocalStore {
  constructor(key) {
    this.key = key;
  }

  set(content) {
    localStorage.setItem(this.key, content);
    return Promise.resolve();
  }
  get() {
    return Promise.resolve(localStorage.getItem(this.key));
  }
};
