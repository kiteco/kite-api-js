'use strict';

const path = require('path');
const {withKite, withKiteRoutes} = require('kite-connector/test/helpers/kite');
const {fakeResponse} = require('kite-connector/test/helpers/http');
const TestClient = require('kite-connector/lib/clients/test-client');
const KiteAPI = require('../../lib');

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

let kitedPaths = {};

function updateKitePaths(paths) {
  for (const k in paths) {
    kitedPaths[k] = paths[k];
  }
}

function withKitePaths(paths = {}, defaultStatus, block) {
  const eventRe = /^\/clientapi\/editor\/event$/;
  const authRe = /^\/clientapi\/permissions\/authorized\?filename=(.+)$/;
  const projectDirRe = /^\/clientapi\/projectdir\?filename=(.+)$/;
  const notifyRe = /^\/clientapi\/permissions\/notify\?filename=(.+)$/;
  const blacklistRe = /^\/clientapi\/permissions\/blacklist/;
  const whitelistRe = /^\/clientapi\/permissions\/whitelist/;

  const whitelisted = match =>
    (kitedPaths.whitelist || []).some(p => match.startsWith(p));
  const blacklisted = match =>
    (kitedPaths.blacklist || []).some(p => match.startsWith(p));
  const ignored = match =>
    (kitedPaths.ignored || []).some(p => match.startsWith(p));

  const routes = [
    [
      o => {
        return o.method === 'POST' && eventRe.test(o.path);
      },
      (o, data) => {
        let filename;
        if (data) {
          ({filename} = JSON.parse(data));
        }

        return data &&
               whitelisted(filename) &&
               !ignored(filename)
                ? fakeResponse(200)
                : fakeResponse(403);
      },
    ], [
      o => notifyRe.exec(o.path),
      o => {
        const match = notifyRe.exec(o.path);
        return match &&
               !whitelisted(match[1]) &&
               !ignored(match[1]) &&
               !blacklisted(match[1])
          ? fakeResponse(200)
          : fakeResponse(403);
      },
    ], [
      o => {
        const match = authRe.exec(o.path);
        return match && whitelisted(match[1]) && !ignored(match[1]);
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
      o => {
        const match = projectDirRe.exec(o.path);
        return fakeResponse(defaultStatus || 200, path.dirname(match[1]));
      },
    ], [
      (o, data) => {
        data = data && JSON.parse(data);
        const [path] = data && Array.isArray(data) ? data : [];
        return whitelistRe.test(o.path) &&
               !(whitelisted(path) || blacklisted(path)) &&
               o.method === 'PUT';
      },
      o => fakeResponse(defaultStatus || 200),
    ], [
      (o, data) => {
        data = data ? JSON.parse(data) : {};
        const path = data.paths ? data.paths[0] : null;
        return blacklistRe.test(o.path) &&
               !(whitelisted(path) || blacklisted(path)) &&
               o.method === 'PUT';
      },
      o => fakeResponse(defaultStatus || 200),
    ],
  ];
  beforeEach(() => { updateKitePaths(paths); });
  withKiteRoutes(routes, block);
}

function withKiteAccountRoutes(routes = [], block) {
  let safeClient;

  beforeEach(() => {
    safeClient = KiteAPI.Account.client;
    KiteAPI.Account.client = new TestClient();
    routes.forEach(route => KiteAPI.Account.client.addRoute(route));
  });

  afterEach(() => {
    KiteAPI.Account.client = safeClient;
  });

  if (block) {
    describe('', () => {
      beforeEach(() => {
        routes.forEach(route => KiteAPI.Account.client.addRoute(route));
      });
      block();
    });
  } else {
    beforeEach(() => {
      routes.forEach(route => KiteAPI.Account.client.addRoute(route));
    });
  }
}

module.exports = {
  updateKitePaths,
  withKite,
  withKiteRoutes,
  withKiteLogin,
  withKitePaths,
  withKiteAccountRoutes,
};
