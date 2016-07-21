An offline tester to validate your custom PHP RedLine13 Load Test.

# Quick Start
### Specify test on Command Line
* npm install
* node loadTester [#TESTS] [TEST CLASS FILE]
* node loadTester 1 CustomTestSimple.js

#### Running On OSX
```bash
npm install
npm uninstall node-libcurl
npm install node-libcurl --build-from-source

# For reference : https://github.com/JCMais/node-libcurl/issues/63
```

# Simulating inputs for test
Modify loadtest.ini with parameters, in your custom test you can access settings via

```javascript
var LoadTestingSession = require("./loadTestingSession.js");

/**
 * Build a custom test by creating a constructor of the 
 * form function CLASS( RedlineApi redlineApi, int testNum, string rand, object config )
 * And providing one method 
 * MyCustomTest.prototype.runTest( CALLBACK )
 * Where after your test is complete the callback is invoked CALLACK(err)
 * err should only be used if there was an error.
 */
function MyCustomTest(redlineApi, testNum, rand, config)
{
	// We need Redline API to report results, errors, requests.
	this.redlineApi = redlineApi;

	// Keep track of test information.
	this.testNum = testNum;
	this.rand = rand;

	// This is the test configuration file (loadtest.ini)
	this.config = config;

	// Hardcode endpoint, requires plugin to customize.
	this.url = this.config.url | "https://httpbin.org/status/200";

	// Would need plugin to customize instead of hard-code.
	this.minDelayMs = this.config.min | 500;
	this.maxDelayMs = this.config.max | 10000;
	this.delayRangeMs = this.maxDelayMs - this.minDelayMs + 1;

	// Would need plugin to customize from test.
	this.remainingIterations =  this.config.iterations | 1;
}

/** Run test */
MyCustomTest.prototype.runTest = function( redlineCallback )
{
```

# Output
The load test will generate local information on performance results and errors.

# Running on 
# More on Custom Performance Tests
https://www.redline13.com/blog/writing-a-custom-load-test/
