import * as logger from '../lib/utils/log'; // allow us to stub the default

// adds these files to Karma's context to test them
const testsContext = require.context('../', true, /^\.\/(lib|inputs)\/.*?\.test\.js$/);

// stub logger
window.loggerStub = {
  info: sinon.spy(),
  trace: sinon.spy(),
  debug: sinon.spy(),
  warn: sinon.spy(),
  error: sinon.spy()
};

sinon.stub(logger, 'default').callsFake(() => {
  // return the same instances of our logging spies every time
  // we create a new logger
  return window.loggerStub;
});

// run all tests
testsContext.keys().forEach(testsContext);
