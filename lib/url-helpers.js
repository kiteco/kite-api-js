'use strict';

const md5 = require('md5');

function hoverPath(filename, source, position, editor) {
  const state = md5(source);
  const buffer = cleanPath(filename);
  return [
    `/api/buffer/${editor}/${buffer}/${state}/hover`,
    `cursor_runes=${position}`,
  ].join('?');
}

function membersPath(id, page, limit) {
  return [
    `/api/editor/value/${id}/members`,
    [
      `offset=${page}`,
      `limit=${limit}`,
    ].join('&'),
  ].join('?');
}

function usagesPath(id, page, limit) {
  return [
    `/api/editor/value/${id}/usages`,
    [
      `offset=${page}`,
      `limit=${limit}`,
    ].join('&'),
  ].join('?');
}

function shouldNotifyPath(path) {
  return `/clientapi/permissions/notify?filename=${encodeURI(path)}`;
}

function statusPath(path) {
  return `/clientapi/status?filename=${encodeURI(path)}`;
}

function projectDirPath(path) {
  return `/clientapi/projectdir?filename=${encodeURI(path)}`;
}

function cleanPath(p) {
  return encodeURI(p)
  .replace(/^([A-Z]):/, '/windows/$1')
  .replace(/\/|\\|%5C/g, ':');
}

module.exports = {
  cleanPath,
  hoverPath,
  membersPath,
  projectDirPath,
  shouldNotifyPath,
  statusPath,
  usagesPath,
};
