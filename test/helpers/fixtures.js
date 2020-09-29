'use strict';

const fs = require('fs');
const path = require('path');
const FIXTURES_ROOT = path.resolve(__dirname, '../fixtures');

function fixturePath(file, root = FIXTURES_ROOT) {
  return path.resolve(root, file);
}

function loadFixture(file, root = FIXTURES_ROOT) {
  return String(fs.readFileSync(fixturePath(file, root)));
}

module.exports = {loadFixture, fixturePath};
