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
	this.url = this.config.url;
	if ( !this.url )
		this.url = "https://httpbin.org/status/200";

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
	var that = this;

	// Set delay
	var delay = 1;
	if (this.delayRangeMs != 0)
		delay = Math.floor((Math.random()*this.delayRangeMs)+this.minDelayMs);
	// delay = 1;

	// Make request after timeout
	console.log("Making request to " + that.url + " in " + delay + "ms.");
	setTimeout(function() {
		try
		{
			// Helper function make HTTP Request.
			that.loadPage(that.url, function( failed ) {
				// Iteration complete
				that.remainingIterations--;

				// Another iteration?
				if (!failed && that.remainingIterations > 0)
					that.runTest(redlineCallback);
				else
					// Callback
					redlineCallback(failed, 'on-load-page' );
			});
		} catch (e) {
			// Callback
			console.log(e);
			that.redlineApi.recordError(""+e + (e.stack ? "\n" + e.stack : ""));
			redlineCallback(true, 'on-exception' );
		}
	}, delay);
};

/**
 * Load Page with RedLine13 curl wrappers, which appropriately handles 
 * recording timing data and errors.  @see LoadTestingSession
 */
MyCustomTest.prototype.loadPage = function(pageUrl, callback)
{
	console.log('MyCustomTest.prototype.loadPage');

	// Resource loading, if true will parse HTTP response body and pull those assets.
	var loadResources = false;
	
	// Using the LoadTestingSession since that handles cookies, wraps curl, and calls proper record functions.
	// Everything within is open and you could use record* functions to build it all yourself.
	var loadTestSess = new LoadTestingSession(this.testNum, this.redlineApi, loadResources);
	loadTestSess.loadPage(pageUrl, callback );
};

// Required Export for Test to be loaded and executed.
module.exports = MyCustomTest;
