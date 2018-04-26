'use strict';

const os = require('os');
const {withKiteRoutes} = require('kite-connect/test/helpers/support');
const {fakeResponse} = require('kite-connect/test/helpers/http');

function withKiteLogin(status) {
  let login;
  afterEach(() => {
    login = undefined;
  });

  withKiteRoutes([[
    o => o.path === '/api/account/login',
    o => {
      login = true;
      return fakeResponse(status);
    },
  ], [
    o => o.path === '/api/account/authenticate',
    o => {
      login = true;
      return fakeResponse(status);
    },
  ], [
    o => o.path === '/clientapi/user',
    o => login
      ? fakeResponse(200, '{"id": "some-id"}')
      : fakeResponse(401),
  ]]);
}

function withKitePaths(paths = {}, defaultStatus) {
  const authRe = /^\/clientapi\/permissions\/authorized\?filename=(.+)$/;
  const projectDirRe = /^\/clientapi\/projectdir\?filename=(.+)$/;
  const whitelisted = match =>
    (paths.whitelist || []).some(p => match.indexOf(p) !== -1);
  const blacklisted = match =>
    (paths.blacklist || []).some(p => match.indexOf(p) !== -1);
  const ignored = match =>
    (paths.ignore || []).some(p => match.indexOf(p) !== -1);

  const routes = [
    [
      o => {
        const match = authRe.exec(o.path);
        return match && whitelisted(match[1]);
      },
      o => fakeResponse(defaultStatus || 200),
    ], [
      o => {
        const match = authRe.exec(o.path);
        return match && (!whitelisted(match[1]) || ignored(match[1]));
      },
      o => fakeResponse(defaultStatus || 403),
    ], [
      o => {
        const match = projectDirRe.exec(o.path);
        return o.method === 'GET' && match && blacklisted(match[1]);
      },
      o => fakeResponse(defaultStatus || 403),
    ], [
      o => projectDirRe.test(o.path),
      o => fakeResponse(defaultStatus || 200, os.homedir()),
    ],
  ];

  withKiteRoutes(routes);
}

module.exports = {
  withKiteLogin,
  withKitePaths,
};
