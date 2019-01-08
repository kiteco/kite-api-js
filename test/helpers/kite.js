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
  withKiteAccountRoutes,
};
