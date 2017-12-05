// setup for unit testing vue components

// needed by vue-testing-utils to set-up a browser environment
require('jsdom-global')();

// needed because Fetch doesn't run in the Mocha environment for some reason
require('isomorphic-fetch')();

// set assertions library
global.expect = require('chai');
