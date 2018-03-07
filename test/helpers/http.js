
/**
 * Creates a fake `http.IncomingMessage` response object  to pass as argument
 * to listeners of the `response` event of a fake request object.
 * The response object has a `on` function that can be used to listen to the
 * `data` and `end` events. In practice, the listeners passed to the `on` event
 * will be immediately called.
 */
function fakeResponse(statusCode, data, props) {
  data = data || '';
  props = props || {};

  const resp = {
    statusCode,
    req: {},
    on(event, callback) {
      switch (event) {
        case 'data':
          callback(data);
          break;
        case 'end':
          callback();
          break;
      }
    },
  };
  for (let k in props) { resp[k] = props[k]; }
  resp.headers = resp.headers || {};
  return resp;
}

/**
 * Sets the `request` property of a response object and returns that response.
 * We use that function to make sure that the fake response holds a reference
 * to its fake request in the same manner an incoming message holds a reference
 * to the client request that emitted it.
 */
function decorateResponse(resp, req) {
  resp.request = req;
  return resp;
}

/**
 * Returns a function that creates a fake `http.ClientRequest` object for
 * the passed-in response argument.
 * The response argument can be either:
 * - a boolean: true = 200 status, false = 500 status
 * - an object: the status will be 200 and the object will be used as the response properties
 * - a string: the status will be 200 and the string wilm be used as the response data
 * - a function: in that case the function must returns a fake response object and will be called
 *   with the options received by the returned function.
 * The fake request object supports the `error` and `response` events
 * as well as the `end` and `write` methods.
 */
function fakeRequestMethod(resp) {
  if (resp) {
    switch (typeof resp) {
      case 'boolean':
        resp = resp ? fakeResponse(200) : fakeResponse(500);
        break;
      case 'object':
        resp = fakeResponse(200, '', resp);
        break;
      case 'string':
        resp = fakeResponse(200, resp, {});
        break;
    }
  }

  return (opts, callback) => {
    const req = {
      on(type, cb) {
        switch (type) {
          case 'error':
            if (resp === false) { cb({}); }
            break;
          case 'response':
            if (resp) { cb(decorateResponse(typeof resp == 'function' ? resp(opts) : resp), req); }
            break;
        }
      },
      end() {
        if (resp) {
          typeof resp == 'function'
            ? callback(decorateResponse(resp(opts), req))
            : callback(decorateResponse(resp, req));
        }
      },
      write(data) {},
      setTimeout(timeout, callback) {
        if (resp == null) { callback({}); }
      },
    };
    return req;
  };
}

/**
 * Given an array of tuples (routes) with a predicate and a handler function, it returns
 * a function that can be used to stub the `http.request` or `https.request` functions.
 * Both the predicate and the handler functions will be called with the options received.
 * The first route whose predicate function returns true will be used and its handler
 * function will be invoked.
 */
function fakeRouter(routes) {
  return (opts) => {
    for (let i = 0; i < routes.length; i++) {
      const [predicate, handler] = routes[i];
      if (predicate(opts)) { return handler(opts); }
    }
    return fakeResponse(404);
  };
}

module.exports = {
  fakeRequestMethod,
  fakeResponse,
  fakeRouter,
};
