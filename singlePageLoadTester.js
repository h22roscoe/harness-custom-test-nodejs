var LoadTestingSession = require("./loadTestingSession.js");
var fs = require('fs');

function SinglePageLoadTester(redlineApi, testNum, rand, config)
{
	// Redline API
	this.redlineApi = redlineApi;
	
	// Test info
	this.testNum = testNum;
	this.rand = rand;
	
	// INI Config
	this.config = config;
	
	// Check for min and max delay
	this.minDelayMs = this.maxDelayMs = null;
	if (config.min_delay_ms && config.max_delay_ms)
	{
		var num = parseInt(config.min_delay_ms, 10);
		if (!isNaN(num))
			this.minDelayMs = num;
		num = parseInt(config.max_delay_ms, 10);
		if (!isNaN(num))
			this.maxDelayMs = num;
	}
	this.delayRangeMs = 0;
	if (this.minDelayMs !== null && this.maxDelayMs !== null)
		this.delayRangeMs = this.maxDelayMs - this.minDelayMs + 1;
	
	// Check for number of iterations
	this.remainingIterations = 1;
	if (config.num_iterations)
	{
		var num = parseInt(config.num_iterations, 10);
		if (!isNaN(num))
			this.remainingIterations = num;
	}
	
	// Parameters
	this.parameters = {
		get: [],
		post: []
	};
	if (config.parameter_file)
	{
		try
		{
			var paramJson = JSON.parse(""+fs.readFileSync(config.parameter_file));
			if (paramJson)
			{
				if (paramJson.get)
					this.parameters.get = paramJson.get;
				if (paramJson.post)
					this.parameters.post = paramJson.post;
			}
		} catch (e) {}
	}
}
	
/** Run test */
SinglePageLoadTester.prototype.runTest = function(callback)
{
	var that = this;
	
	// Set delay
	var delay = 1;
	if (this.delayRangeMs != 0)
		delay = Math.floor((Math.random()*this.delayRangeMs)+this.minDelayMs);
	
	// Make request after timeout
	setTimeout(function() {
		try
		{
			that.loadPage(that.config.url, function(failed) {
				// Iteration complete
				that.remainingIterations--;
				
				// Another iteration?
				if (!failed && that.remainingIterations > 0)
					that.runTest(callback);
				else
				{
					// Callback
					if (callback)
						callback.call(that, failed);
				}
			});
		} catch (e) {
			// Callback
			if (callback)
				callback.call(that, failed);
		}
	}, delay);
};
	
/** Load Page */
SinglePageLoadTester.prototype.loadPage = function(pageUrl, callback)
{
	var that = this;	
	// Resource loading?
	var loadResources = that.config.load_resources == "1";
	var loadTestSess = new LoadTestingSession(that.testNum, that.redlineApi, loadResources);
	loadTestSess.setParameters(this.parameters);
	loadTestSess.loadPage(pageUrl, function(failed) {
		// Callback
		if (callback)
			callback.call(that, failed);
	});
};

module.exports = SinglePageLoadTester;
