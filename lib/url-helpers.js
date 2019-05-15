'use strict';

const md5 = require('md5');

function onboardingFilePath(editor, language) {
  return [
    '/clientapi/plugins/onboarding_file', [
      `editor=${editor}`,
      `language=${language}`,
    ].join('&'),
  ].join('?');
}

function hoverPath(filename, source, position, editor, encoding) {
  const state = md5(source);
  const buffer = cleanPath(filename);
  return [
    `/api/buffer/${editor}/${buffer}/${state}/hover`,
    [
      `cursor_runes=${position}`,
      `offset_encoding=${encoding}`,
    ].join('&'),
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
  onboardingFilePath,
  hoverPath,
  membersPath,
  projectDirPath,
  shouldNotifyPath,
  statusPath,
  usagesPath,
};
