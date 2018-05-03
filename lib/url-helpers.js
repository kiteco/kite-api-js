'use strict';

const md5 = require('md5');

function hoverPath(filename, source, position) {
  const state = md5(source);
  const buffer = cleanPath(filename);
  return [
    `/api/buffer/atom/${buffer}/${state}/hover`,
    `cursor_runes=${position}`,
  ].join('?');
}

function cleanPath(p) {
  return encodeURI(p)
  .replace(/^([A-Z]):/, '/windows/$1')
  .replace(/\/|\\|%5C/g, ':');
}

module.exports = {hoverPath, cleanPath};
