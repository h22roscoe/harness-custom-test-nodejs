
var RedlineApi = function()
{
};

RedlineApi.prototype.getTimeStamp = function()
{
	return Math.floor((new Date()).getTime()/1000);
}
/**
 * Send JSON message
 *
 * @param {mixed} json JSON data to send
 */
RedlineApi.prototype.sendMessage = function(type, message)
{
	var msg = JSON.stringify(message);
	console.log( "send:("+type+")" , msg);
}

/**
 * Record server start.
 * FRAMEWORK ONLY.
 * @param {int} ts timestamp of user start
 */
RedlineApi.prototype.recordServerStart = function(ts)
{
	this.sendMessage("MESSAGE_TYPE_SERVER_START", [ts|this.getTimeStamp()] );
};

/**
 * Record server stop.
 * FRAMEWORK ONLY.
 * @param {int} ts timestamp of user start
 */
RedlineApi.prototype.recordServerStop = function(ts)
{
	this.sendMessage("MESSAGE_TYPE_SERVER_STOP", [ts|this.getTimeStamp()] );
};

/**
 * Record user start.
 * @param {string} userId Each users gets an identifier to correllate.
 * @param {int} ts timestamp of user start
 */
RedlineApi.prototype.recordUserStart = function( userName, ts )
{
	this.sendMessage("MESSAGE_TYPE_USER_START", [userName,ts|this.getTimeStamp()] );
};

/**
 * Record user stop.
 * @param {string} userId Each users gets an identifier to correllate.
 * @param {int} ts timestamp of end
 * @param {float} time elapse time of user
 * @param {boolean} err If the user ended in error.
 * @param {int} kb kb downloaded.
 */
RedlineApi.prototype.recordUserStop = function( userId, ts, time, err, kb )
{
	if ( !time ) time = 0;
	if ( !err ) err = false;
	if ( !kb ) kb = 0;
	if ( !ts ) ts = this.getTimeStamp();
	this.sendMessage("MESSAGE_TYPE_USER_STOP", [userId, ts, time, err, kb] );
};

/**
 * Update running count
 * @param {int} delta Increment by this amount
 */
RedlineApi.prototype.updateRunningCount = function(delta)
{
	this.sendMessage("MESSAGE_TYPE_RUNNING_COUNT", [delta] );
};

/**
 * Update failed count
 * @param {int} delta Increment by this amount
 */
RedlineApi.prototype.updateFailedCount = function(delta)
{
	this.sendMessage("MESSAGE_TYPE_FAILED_COUNT", [delta] );
};

/**
 * Update completed count
 * @param {int} delta Increment by this amount
 */
RedlineApi.prototype.updateCompletedCount = function(delta)
{
	this.sendMessage("MESSAGE_TYPE_COMPLETED_COUNT", [delta] );
};

// Public API

/**
 * Record the load time for a page
 *
 * @param {int} ts Timestamp
 * @param {float} Page load time
 */
RedlineApi.prototype.recordPageTime = function(ts, time, err, kb)
{
	if ( !ts ) ts = this.getTimeStamp();
	if ( !time ) time = 0;
	if ( !err ) err = false;
	if ( !kb ) kb = 0;
	this.sendMessage("MESSAGE_TYPE_LOAD_TIME_PER_SEC", [ts, time, err, kb] );
};

/**
 * Record URL load
 *
 * @param {string} url URL
 * @param {int} ts Timestamp
 * @param {float} Page load time
 */
RedlineApi.prototype.recordURLPageLoad = function(url, ts, time, err, kb)
{
	this.sendMessage( "MESSAGE_TYPE_URL_LOAD", [url, ts, time, err, kb] );
};

/**
 * Record error
 *
 * @param {string} error Error message
 */
RedlineApi.prototype.recordError = function(errorMessage, ts)
{
	this.sendMessage( "MESSAGE_TYPE_ERROR", [ts,errorMessage] );
};

/**
 * Record download size
 *
 * @param {int} kb Number of KB downloaded
 */
RedlineApi.prototype.recordDownloadSize = function(kb)
{
	this.sendMessage( "MESSAGE_TYPE_DOWNLOAD_SIZE", [kb] );
};

/**
 * Record progress of the test (0-100)
 *
 * @param {int} tetsNum Test number
 * @param {int} percent Percent completed (0-100)
 */
RedlineApi.prototype.recordProgress = function(testNum, percent)
{
	this.sendMessage( this.MESSAGE_TYPE_PROGRESS, [testNum, percent] );
};

module.exports = RedlineApi;
