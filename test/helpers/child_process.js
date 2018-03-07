const proc = require('child_process');
const sinon = require('sinon');
const {merge} = require('./utils');

/**
 * Returns a function that can act as a fake standard stream in a fake `spawn` method.
 * The function has a `on`  method that can registrate a listener for the `data` event.
 * When invoked, the return function will call back the listener we the passed-in data.
 */
function fakeStdStream() {
  let streamCallback;
  function stream(data) {
    streamCallback && streamCallback(data);
  }

  stream.on = (evt, callback) => {
    if (evt === 'data') { streamCallback = callback; }
  };

  return stream;
}

// Where we store every fake commands we're going to create
let _commands;

/**
 * Generates fake commands to be invoked either through `spawn`, `spawnSync`
 * or `exec` in the `child_process` module.
 * The three functions will only be stubbed once so successive calls to that
 * function will only appends/overwrite commands.
 * `commands` is an object where the keys represents the commands to register
 * and values are functions that takes the fake process object as first argument
 * and the commands args as the second argument.
 * The process object has two function `stdout` and `stderr` that will set the
 * corresponding string when invoked (and dispatch a `data` event on the
 * corresponding streams).
 * The function should return either `0` or `1` to define the command execution
 * status .
 */
function fakeCommands(commands) {
  if (proc.spawn.isSinonProxy) {
    _commands = merge(_commands, commands);
  } else {
    sinon.stub(proc, 'spawn').callsFake((process, options) => {
      const mock = _commands[process];
      const ps = {
        stdout: fakeStdStream(),
        stderr: fakeStdStream(),
        on: (evt, callback) => {
          if (evt === 'close') { callback(mock ? mock(ps, options) : 1); }
        },
      };

      return ps;
    });

    sinon.stub(proc, 'spawnSync').callsFake((process, options) => {
      const mock = _commands[process];

      const ps = {};
      ps.status = mock ? mock({
        stdout(data) { ps.stdout = data; },
        stderr(data) { ps.stderr = data; },
      }, options) : 1;

      return ps;
    });


    _commands = commands;
  }

  if (commands.exec && !proc.exec.isSinonProxy) {
    sinon.stub(proc, 'exec').callsFake((process, options, callback) => {
      const mock = _commands.exec[process];

      let stdout, stderr;

      const status = mock ? mock({
        stdout(data) { stdout = data; },
        stderr(data) { stderr = data; },
      }, options) : 1;

      status === 0
      ? callback(null, stdout)
      : callback({}, stdout, stderr);
    });
  }
}

module.exports = {
  fakeCommands,
  fakeStdStream,
};
