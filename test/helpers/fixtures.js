'use strict';

const fs = require('fs');
const path = require('path');

const FIXTURES_ROOT = path.resolve(__dirname, '../fixtures');

function fixturePath(file) {
  return path.resolve(FIXTURES_ROOT, file);
}

function loadFixture(file) {
  return fs.readFileSync(fixturePath(file));
}

module.exports = {loadFixture, fixturePath};
