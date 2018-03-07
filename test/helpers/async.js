
/**
 * An async helper that returns a promise that resoves when the provided
 * function returns true.
 * You can typically use that function as the return value of a before/beforeEach
 * block in order to make sure successives tests run after the condition was met
 */
function waitsFor(msg, cond, t, i) {
  if (typeof msg === 'function') {
    i = t;
    t = cond;
    cond = msg;
    msg = 'something to happen';
  }

  const intervalTime = i || 10;
  const timeoutDuration = t || 2000;

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (cond()) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, intervalTime);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Waited ${timeoutDuration}ms for ${msg} but nothing happened`));
    }, timeoutDuration);
  });
}

/**
 * A waitsFor condition that only evaluates to true after a given duration.
 * Avoid using this function unless you want to fix flaky tests or tests
 * with race conditions.
 */
function sleep(duration) {
  const t = new Date();
  return waitsFor(`${duration}ms`, () => { return new Date() - t > duration; });
}

/**
 * Delays the execution of the given block after a specific duration.
 * Same thing as with sleep, you should avoid using this function unless when
 * dealing with asynchronous events that can't be affected (i.e. DOM parsing)
 */
function delay(duration, block) {
  return new Promise((resolve) => {
    setTimeout(() => {
      block();
      resolve();
    }, duration);
  });
}

module.exports = {
  delay,
  sleep,
  waitsFor,
};
