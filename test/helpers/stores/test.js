'use strict';

module.exports = class TestStore {
  constructor() {}
  set(content) {
    this.content = content;
    return Promise.resolve();
  }
  get() {
    return Promise.resolve(this.content);
  }
};
