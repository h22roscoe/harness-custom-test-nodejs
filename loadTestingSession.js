var LoadTestingHttpRequest = require("./loadTestingHttpRequest.js");

/**
 * LoadTestingSession
 * @constructor
 * @param {int} testNum Test number
 * @param {RedlineApi} redlineApi Redline API
 * @param {bool} loadResources Load resources (e.g. CSS, JS, and images)
 */
function LoadTestingSession(testNum, redlineApi, loadResources)
{
	this.testNum = testNum;
	
	// Redline API
	this.redlineApi = redlineApi;
	
	// Loading resources info
	this.loadResources = loadResources;
	this.requiredResourceBaseUrl = null;
	
	// Cache
	this.browserCache = {};
	
	// Cookies
	this.cookies = {};
	
	// Cookie file
	this.cookieFile = "cookies/test" + testNum + ".txt";
	
	// Parameters
	this.parameters = {};
}

/**
 * Set required base URL for resources
 *
 * @param {string} requiredResourceBaseUrl Required base URL to check for
 */
LoadTestingSession.prototype.requiredBaseUrl = function(requiredResourceBaseUrl)
{
	this.requiredResourceBaseUrl = requiredResourceBaseUrl;
}

/**
 * Set parameters
 *
 * @param {object} parameters Object with keys for "get" and "post" variables.
 * 	Each is an array of parameters.  Each parameter should have a "name" and "val"
 * 	field.
 */
LoadTestingSession.prototype.setParameters = function(parameters)
{
	this.parameters = parameters;
}

/**
 * Load Page
 *
 * @param {string} pageUrl URL to load
 * @param {function} callback Callback function (optional)
 */
LoadTestingSession.prototype.loadPage = function(pageUrl, customTestCallback)
{
	var that = this;
	if ( !customTestCallback ){
		customTestCallback = function(){};
	}
	
	// Request page
	var loadTestHttpReq = new LoadTestingHttpRequest(pageUrl, this.redlineApi);
	loadTestHttpReq.setCookieFile(this.cookieFile);
	loadTestHttpReq.setParameters(this.parameters);
	loadTestHttpReq.loadPage({}, function() {

		// Check for error
		if (this.error != null) {
			customTestCallback.call(this, true);
		}
		else {
			// TODO: Should we have an option to check the return code
			// Check status
			if (this.response.status != 200) {
				// Record error
				if (that.redlineApi) {
					var msg = "HTTP Response code: " + this.response.status;
					that.redlineApi.recordError(msg);
				}
				
				customTestCallback.call(this, true);
			}
			else
			{
				// Parse response headers
				that.parseResponseHeaders(pageUrl, this.headers);
				
				// Load resources
				if (that.loadResources) {
					// Wait until resources are loaded to call callback
					that.doResourceLoading(this, customTestCallback);
				} else {
					customTestCallback.call(this, false);
				}
			}
		}
	});
}

/**
 * Parse response headers
 *
 * @param {string} pageUrl URL
 * @param {array} headers Response headers
 */
LoadTestingSession.prototype.parseResponseHeaders = function(pageUrl, headers)
{
	// Browser cache info
	this.browserCache[pageUrl] = {};
	var ts = Math.floor((new Date()).getTime()/1000);
	
	// Process headers
	for (var i = 0; i < headers.length; i++)
	{
		var header = headers[i].header.toLowerCase();
		switch( header ){
			case 'cache-control':
				var value = headers[i].value.toLowerCase();
				var match = /^max-age=([0-9]+)$/.exec(value);
				if ( match ){
					this.browserCache[pageUrl]['expiresTs'] = ts+match[1];
				}
				break;
			case 'expires':
				var value = headers[i].value.toLowerCase();
				var expires = Date.parse(value);
				if (!isNaN(expires))
					this.browserCache[pageUrl]['expiresTs'] = expires;
				break;
			case 'last-modified':
				var value = headers[i].value.toLowerCase();
				this.browserCache[pageUrl]['Last-Modified'] = value;
				break;
			case 'etag':
				var value = headers[i].value.toLowerCase();
				this.browserCache[pageUrl]['ETag'] = value;
				break;
		}
	}
}

/**
 * Check for cache page
 *
 * @param {string} pageUrl URL
 *
 * @return {bool} True if cached
 */
LoadTestingSession.prototype.isCached = function(pageUrl)
{
	if (pageUrl in this.browserCache)
	{
		if ("expiresTs" in this.browserCache[pageUrl])
		{
			var ts = Math.floor((new Date()).getTime()/1000);
			if (ts <= this.browserCache[pageUrl]["expiresTs"])
				return true;
		}
	}
	return false;
}

/**
 * Check for caching request header
 *
 * @param {string} pageUrl URL
 * @return {array} Headers
 */
LoadTestingSession.prototype.getCachingRequestHeaders = function(pageUrl)
{
	var headers = [];
	if (pageUrl in this.browserCache)
	{
		// Check if we have a last modified
		if ("Last-Modified" in this.browserCache[pageUrl])
			headers.push("If-Modified-Since: " + this.browserCache[pageUrl]["Last-Modified"]);
		// Check if we have an ETag
		if ("ETag" in this.browserCache[pageUrl])
			headers.push("If-None-Match: " + this.browserCache[pageUrl]["Last-Modified"]);
	}
	return headers;
}

/**
 * Do resource loading
 *
 * @param {LoadTestingHttpRequest} loadTestHttpReq Request object
 * @param {function} callback Callback function (optional)
 */
LoadTestingSession.prototype.doResourceLoading = function(loadTestHttpReq, callback)
{
	var that = this;
	if ( !callback ){
		callback = function(){};
	}

	// Load JSDom
	loadTestHttpReq.setupJsDom(function() {
		var resUrls = this.getURLsToDownload();
		var numLoadedRes = 0;
		
		// Filter out by requiredResourceBaseUrl
		if (this.requiredResourceBaseUrl != null)
		{
			var tmpUrls = resUrls;
			resUrls = [];
			for (var i = 0; i < tmpUrls.length; i++)
			{
				if (this.requiredResourceBaseUrl.length < tmpUrls[i].length)
				{
					var baseUrlMatch = true;
					for (var j = 0; baseUrlMatch && j < this.requiredResourceBaseUrl.length; j++)
					{
						if (this.requiredResourceBaseUrl[j] != tmpUrls[i][j])
							baseUrlMatch = false;
					}
					if (baseUrlMatch)
						resUrls.push(tmpUrls[i]);
				}
			}
		}
		
		// Check if there are no resources
		if (resUrls.length == 0) {
			callback.call(this, false);
		}
		
		// Load other resources
		var failed = false;
		for (var i = 0; i < resUrls.length; i++)
		{
			(function(pageUrl) {
				// Check cache
				if (that.isCached(pageUrl))
				{
					console.log(pageUrl + " found in cache.");
					
					// Is this the last resource?
					numLoadedRes++;
					if (numLoadedRes == resUrls.length) {
						callback.call(this, failed);
					}
				}
				else
				{
					// Set up headers
					var headers = that.getCachingRequestHeaders(pageUrl);
					headers.push('Cache-Control:max-age=0');
					headers.push('Connection: keep-alive');
					headers.push('Keep-Alive: 300');
					
					// Set up curl options
					var curlOpts = {
						HTTPHEADER: headers,
						FORBID_REUSE: 0,
						FRESH_CONNECT: 0
					};

					// Request page
					var loadTestHttpReq = new LoadTestingHttpRequest(pageUrl, that.redlineApi);
					loadTestHttpReq.setCookieFile(that.cookieFile);
					loadTestHttpReq.loadPage(curlOpts, function() {
						// Check for error
						if (this.error != null)
						{
							failed = true;
							console.log(pageUrl + " error: " + this.error);
						}
						else
						{
							console.log(pageUrl + " status code: " + this.response.status);
							
							// TODO: Should we have an option to check the return code
							// Check status
							if (this.response.status != 200)
							{
								// Record error
								var msg = "HTTP Response code: " + this.response.status;
								
								// Redline API call
								if (that.redlineApi)
									that.redlineApi.recordError(msg);
								
								// Ignore error
							}
							else
							{
								// Parse response headers
								that.parseResponseHeaders(pageUrl, this.headers);
							}
						}
						
						// Is this the last resource?
						numLoadedRes++;
						if (numLoadedRes == resUrls.length) {
							callback.call(this, failed);
						}
					});
				}
			})(resUrls[i]);
		}
	});
}

module.exports = LoadTestingSession;
