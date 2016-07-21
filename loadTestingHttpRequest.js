// Use CURL Wrapper
var Curl = require("node-libcurl").Curl;

// Used for Parsing Results and getting sub-items.
var jsdom = require("jsdom");
jsdom.defaultDocumentFeatures = {
	FetchExternalResources: false
};

/**
 * LoadTestingHttpRequest
 *
 * @param {string} pageUrl Page URL
 * @param {RedlineApi} redlineApi Redline API
 * @param {Curl} Curl instance
 */
function LoadTestingHttpRequest(pageUrl, redlineApi, curl)
{
	this.curl = curl ? curl : new Curl();
	this.pageUrl = pageUrl;
	this.body = "";
	this.requestStartTime = null;
	this.responseTime = null;
	this.response = null;
	this.error = null;
	this.jsdomWindow = null;
	this.timing = {};
	this.headers = [];
	
	// API info
	this.redlineApi = redlineApi;
	
	// Parameters
	this.parameters = {};
}

/**
 * Set cookie file
 *
 * @param {string} cookieFile Cookie filename
 */
LoadTestingHttpRequest.prototype.setCookieFile = function(cookieFile)
{
	this.cookieFile = cookieFile;
}

/**
 * Set parameters
 * 
 * @param {object} parameters Object with keys for "get" and "post" variables.
 * 	Each is an array of parameters.  Each parameter should have a "name" and "val"
 * 	field.
 */
LoadTestingHttpRequest.prototype.setParameters = function(parameters)
{
	this.parameters = parameters;
}

/**
 * Load Page
 *
 * @param {object} addlCurlOpts Additional curl parameters to add
 * @param {function} callback Callback function (optional)
 */
LoadTestingHttpRequest.prototype.loadPage = function(addlCurlOpts, callback)
{
	if (!callback)
		callback = function(){};
	var curl = this.curl;
	var that = this;
	try {
		// Set up options
		curl.setOpt(Curl.option.FORBID_REUSE, true );
		curl.setOpt(Curl.option.FOLLOWLOCATION, true );
		curl.setOpt(Curl.option.CONNECTTIMEOUT, 30 );
		// ENCODING: 'gzip' // ACCEPT_ENCODING: 'gzip', this option is dependent on version deployed.  Need to figure out how to make this configured or upgrade all.

		// Build URL and examine GET parameters.
		var realPageUrl = this.pageUrl;
		if (("get" in this.parameters) && this.parameters.get.length > 0) {
			var paramStr = [];
			for (var j = 0; j < this.parameters.get.length; j++)
				paramStr.push(encodeURIComponent(this.parameters.get[j].name) + "=" + encodeURIComponent(this.parameters.get[j].val));
			paramStr = paramStr.join("&");
				
			var questionPos = realPageUrl.indexOf('?');
			var hashPos = realPageUrl.indexOf('#');
			if (questionPos !== -1){
				if (hashPos !== -1)
					realPageUrl = realPageUrl.substring(0, hashPos) + '&' + paramStr + realPageUrl.substring(hashPos);
				else
					realPageUrl += '&' + paramStr;
			} else {
				if (hashPos !== -1)
					realPageUrl = realPageUrl.substring(0, hashPos) + '?' + paramStr + realPageUrl.substring(hashPos);
				else
					realPageUrl += '?' + paramStr;
			}
		}
		curl.setOpt(Curl.option.URL, realPageUrl );

			// Check for post
		if (("post" in this.parameters) && this.parameters.post.length > 0) {
			var POSTFIELDS = [];
			for (var j = 0; j < this.parameters.post.length; j++)
				POSTFIELDS.push(encodeURIComponent(this.parameters.post[j].name) + "=" + encodeURIComponent(this.parameters.post[j].val));
			POSTFIELDS = POSTFIELDS.join("&");
			curl.setOpt( Curl.option.POSTFIELDS, POSTFIELDS );
		}

		// Add request headers
		for (key in addlCurlOpts)
			curl.setOpt( key, addlCurlOpts[key] );

		// Cookie info
		if (this.cookieFile){
			curl.setOpt( Curl.option.COOKIEFILE , this.cookieFile );
			curl.setOpt( Curl.option.COOKIEJAR , this.cookieFile );
		}
		// curl.setOpt(Curl.option.VERBOSE, true );

		// Get timestamp
		this.requestStartTime = new Date();
		var ts = Math.floor(this.requestStartTime.getTime()/1000);

		curl.perform();

		curl.on( 'error', function ( err, curlErrCode ){
			console.log(err, curlErrCode );
			that.error = err;
			that.redlineApi.recordError(""+that.error);
			curl.close.bind( curl );
			callback.call(that);
		});

		curl.on( 'end', function( status, body, headers ) {
			// Parse incoming params and save.
			that.response = {};
			that.response.status = status;
			that.response.body = body;
			if ( headers.length > 0 ){
				headers = headers[0];
				for ( header in headers ){
					that.headers.push({header:header,value:headers[header]});
				}
			}
			var requestError = status < 200 || status >= 400;

			// Get timing info
			that.responseTime = curl.getInfo( Curl.info.TOTAL_TIME );
			that.timing.namelookup = curl.getInfo( Curl.info.NAMELOOKUP_TIME );
			that.timing.connect = curl.getInfo( Curl.info.CONNECT_TIME );
			that.timing.appconnect = curl.getInfo( Curl.info.APPCONNECT_TIME );
			that.timing.pretransfer = curl.getInfo( Curl.info.PRETRANSFER_TIME );
			that.timing.starttransfer = curl.getInfo( Curl.info.STARTTRANSFER_TIME );
			that.timing.redirect = curl.getInfo( Curl.info.REDIRECT_TIME );

			// Redline API calls
			if (that.redlineApi) {
				// Record URL load
				var strippedUrl = realPageUrl;
				var pos = strippedUrl.indexOf('?');
				if (pos != -1)
					strippedUrl = strippedUrl.substring(0, pos);
				else {
					var pos = strippedUrl.indexOf('#');
					if (pos != -1)
						strippedUrl = strippedUrl.substring(0, pos);
				}
				that.redlineApi.recordURLPageLoad(strippedUrl, ts, that.responseTime, requestError, downloadSize);

				// Download size
				var downloadSize = curl.getInfo( Curl.info.SIZE_DOWNLOAD );
				if (downloadSize > 0)
					that.redlineApi.recordDownloadSize(downloadSize/1024);
			}

			// Call callback
			callback.call(that);
		});
	} catch (e) {
		console.log(e);
		that.error = e;
		
		// Call callback
		callback.call(that);
	}
}

/**
 * Get URLs to download
 * @param {function} callback Callback function (optional)
 */
LoadTestingHttpRequest.prototype.setupJsDom = function(callback)
{
	(function(that) {
		jsdom.env({
			html: that.response.body,
			done: function (errors, window) {
				// Set window
				that.jsdomWindow = window;
				
				// Call callback
				if (callback)
					callback.call(that);
			}
		});
	})(this);
}

/**
 * Get URLs to download
 *
 * @return {array} URLs to download
 */
LoadTestingHttpRequest.prototype.getURLsToDownload = function()
{
	if (this.jsdomWindow == null)
		throw "JS DOM not loaded.";
	
	// Get bases
	var baseUrl = this.getBaseUrl();
	var absBaseUrl = this.getAbsoluteBaseUrl();
	
	var elems = this.jsdomWindow.document.querySelectorAll("link,script,img");
	var resUrls = [];
	for (var i = 0; i < elems.length; i++)
	{
		var elem = elems[i];
		var resUrl = null;
		if (elem.nodeName == "LINK")
			resUrl = elem.getAttribute("href");
		else
			resUrl = elem.getAttribute("src");
		if (resUrl !== null)
		{
			resUrl = this.createFullUrl(baseUrl, absBaseUrl, resUrl);
			resUrls.push(resUrl);
		}
	}
	
	return resUrls;
}

/**
 * Get base URL
 *
 * @return {string} Base URL
 */
LoadTestingHttpRequest.prototype.getBaseUrl = function()
{
	var baseUrl = this.pageUrl;
	var base = this.jsdomWindow.document.getElementsByTagName("base");
	if (base.length > 0)
		baseUrl = base[0].getAttribute("href");
	
	// Check for URLs in the form http://www.domain.com with no trailing slashes
	if (baseUrl.match(/^[a-z]+:\/\/[^\/]+$/i))
	{}
	else if ((match = baseUrl.match(/^([a-z]+:\/\/(?:.*\/)+)[^\/]+$/i)))
		baseUrl = match[1];
	
	// Add trailing slash
	if (baseUrl[baseUrl.length-1] != '/')
		baseUrl += '/';
	
	return baseUrl;
},

/**
 * Get absolute base URL
 *
 * @return {string} Base URL
 */
LoadTestingHttpRequest.prototype.getAbsoluteBaseUrl = function()
{
	var baseUrl = this.getBaseUrl(this.pageUrl, this.jsdomWindow);
	if ((match = baseUrl.match(/^([a-z]+:\/\/[^\/]+\/)/i)))
		baseUrl = match[1];
	
	return baseUrl;
},

/**
 * Create full url
 * 
 * @param {string} baseUrl Base URL
 * @param {string} absBaseUrl Base URL for absolute links
 * @param {string} pageUrl Page URL to construct the full URL for
 *
 * @return {string} Full URL for pageUrl
 */
LoadTestingHttpRequest.prototype.createFullUrl = function(baseUrl, absBaseUrl, pageUrl)
{
	// Full URL already
	if (pageUrl.match(/^([a-z]+:\/\/[^\/]+)/i))
	{}
	else if (pageUrl.length == 0)
	{}
	// Hash
	else if (pageUrl[0] == '#')
	{}
	// Absolule URL
	else if (pageUrl[0] == '/')
	{
		if (pageUrl.length >= 2 && pageUrl[1] == '/')
		{
			var protocol = "http:";
			var idx = absBaseUrl.indexOf(":");
			if (idx != -1)
				protocol = absBaseUrl.substr(0, idx+1);
			pageUrl = protocol + pageUrl;
		}
		else
			pageUrl = absBaseUrl + pageUrl.substr(1);
	}
	// Relative URL
	else if (pageUrl[0] == '/')
		pageUrl = baseUrl + pageUrl;
	
	return pageUrl;
}

module.exports = LoadTestingHttpRequest;
