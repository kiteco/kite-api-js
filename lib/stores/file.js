'use strict';

const fs = require('fs');

module.exports = class FileStore {
  constructor(path) {
    this.path = path;
  }

  set(content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(this.path, content, 'utf-8', (err) => {
        err ? reject(err) : resolve();
      });
    });
  }

  get() {
    return new Promise((resolve, reject) => {
      fs.readFile(this.path, (err, content) => {
        err ? resolve() : resolve(String(content));
      });
    });
  }
};
