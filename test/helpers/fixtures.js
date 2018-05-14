'use strict';

const fs = require('fs');
const path = require('path');
const {MAX_FILE_SIZE} = require('../../lib/constants');

const FIXTURES_ROOT = path.resolve(__dirname, '../fixtures');

function fixturePath(file, root = FIXTURES_ROOT) {
  return path.resolve(root, file);
}

function loadFixture(file, root = FIXTURES_ROOT) {
  return String(fs.readFileSync(fixturePath(file, root)));
}

let hugeSource;
function getHugeSource() {
  if (hugeSource) { return hugeSource; }

  hugeSource = '';
  while (hugeSource.length < MAX_FILE_SIZE) {
    hugeSource += new Array(100).join(Math.random().toString(36).substring(2, 15)) + '\n';
  }
  return hugeSource;
}

module.exports = {loadFixture, fixturePath, getHugeSource};
