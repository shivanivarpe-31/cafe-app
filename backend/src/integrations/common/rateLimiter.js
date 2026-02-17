/**
 * Rate Limiter
 * Prevents hitting API rate limits by queuing requests
 *
 * Zomato: 100 requests per minute
 * Swiggy: 60 requests per minute
 */

class RateLimiter {
  constructor(platform, requestsPerMinute = 60) {
    this.platform = platform;
    this.requestsPerMinute = requestsPerMinute;
    this.requests = []; // Timestamps of requests
    this.queue = []; // Queued requests
    this.processing = false;
  }

  /**
   * Execute a function with rate limiting
   * @param {Function} fn - Function to execute
   * @returns {Promise} Result of the function
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Process the request queue
   */
  async _processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const canProceed = await this._checkLimit();

      if (!canProceed) {
        // Wait before processing next request
        const waitTime = this._calculateWaitTime();
        console.log(
          `[RateLimiter] ${this.platform} - Rate limit reached, waiting ${waitTime}ms`
        );
        await this._delay(waitTime);
        continue;
      }

      // Process next request
      const { fn, resolve, reject } = this.queue.shift();
      this._recordRequest();

      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Check if we can make another request
   * @returns {boolean} True if under rate limit
   */
  async _checkLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter((time) => time > oneMinuteAgo);

    // Check if we're under the limit
    return this.requests.length < this.requestsPerMinute;
  }

  /**
   * Record a request timestamp
   */
  _recordRequest() {
    this.requests.push(Date.now());
  }

  /**
   * Calculate how long to wait before next request
   * @returns {number} Milliseconds to wait
   */
  _calculateWaitTime() {
    if (this.requests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...this.requests);
    const timeSinceOldest = Date.now() - oldestRequest;
    const timeToWait = Math.max(0, 60000 - timeSinceOldest);

    return timeToWait + 100; // Add small buffer
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   * @returns {object} Status information
   */
  getStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requests.filter((time) => time > oneMinuteAgo);

    return {
      platform: this.platform,
      limit: this.requestsPerMinute,
      used: recentRequests.length,
      remaining: this.requestsPerMinute - recentRequests.length,
      queueLength: this.queue.length,
      resetIn: recentRequests.length > 0
        ? Math.max(0, 60000 - (now - Math.min(...recentRequests)))
        : 0,
    };
  }

  /**
   * Clear all pending requests
   */
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`[RateLimiter] ${this.platform} - Cleared ${clearedCount} queued requests`);
    return clearedCount;
  }
}

module.exports = RateLimiter;
