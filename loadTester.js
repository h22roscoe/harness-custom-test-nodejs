var fs = require("fs");
var RedlineApi = require("./redlineApi.js");

var LoadTester =
{
	/** File with test. */
	classFilename : null,

	/** Number of tests to run. */
	numTests: 1,
	
	/** INI config */
	config: {},
	
	/** Load test rand */
	rand: null,
	
	/** Redline API */
	redlineApi: null,
	
	/** Track if server stop is called. */
	serverStopped : false,

	serverStop: function(err)
	{
		// Output error
		console.log(err);
		
		// Record error
		if ( this.serverStopped === false ){
			this.serverStopped = true;
			this.redlineApi.recordError(""+err + (err.stack ? "\n" + err.stack : ""));
			this.redlineApi.recordServerStop();
			process.exit();
		}
	},

	/** Run tests */
	runTests: function()
	{
		var that = this;

		// Set up Redline API
		console.log("Setting up Redline API.");
		this.redlineApi = new RedlineApi();
		this.redlineApi.recordServerStart();

		// Total users to simulate.
		totalNumTests = this.numTests;
		
		// Catch exceptions
		process.on('uncaughtException', function (err) {
			that.serverStop(err);
		});

		// Load class
		console.log("Loading class.");
		var testClass = null;
		try {
			testClass = require(LoadTester.classFilename);
		} catch (e) {
			this.serverStop(e);
		}

		// Wait until start time and start up each 'user'
		var waitStartDelay = 1000;
		console.log("Starting test in " + waitStartDelay + "ms.");
		setTimeout(function() {
			for (var i = 0; i < that.numTests; i++) {
				that.runTest( that, i, testClass );
			}
		}, waitStartDelay);
	},
	
	/** Encapsulate running each user separately. */
	runTest: function( that, i, testClass ){
		// Create user name and start time.
		var userName = "user-"+i;
		var userStart = new Date().getTime();
		that.redlineApi.recordUserStart(userName);

		try {
			// Create the test class for each user and invoke run Test.
			var test = new testClass(that.redlineApi, i, that.rand, that.config);
			test.runTest(function(failed) {
				var userStop = new Date().getTime();
				that.redlineApi.recordUserStop(userName,userStop/1000,userStop-userStart,failed);
			});
		} catch (err) {
			var userStop = new Date().getTime();
			that.redlineApi.recordError("Failed to launch: "+err + (err.stack ? "\n" + err.stack : ""));
			that.redlineApi.recordUserStop(userName,userStop/1000,userStop-userStart,true);
		}
	}
};

// Start test
console.log("Starting test.");

// Run tests
LoadTester.numTests = parseInt(process.argv[2], 10);
LoadTester.classFilename = "./" + process.argv[3];

// Load config ini if available
try{
	var fs = require('fs'), ini = require('ini');
	LoadTester.config = ini.parse(fs.readFileSync('loadtest.ini', 'utf-8'))	
}catch(e){}

console.log("Config:", LoadTester.config);

// Get rand
LoadTester.rand = process.argv[4];

// Run tests
LoadTester.runTests();
