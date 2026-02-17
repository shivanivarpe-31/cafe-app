/**
 * Retry Handler with Exponential Backoff
 * Automatically retries failed API calls with increasing delays
 *
 * Retry schedule:
 * - Attempt 1: Immediate
 * - Attempt 2: Wait 1 second
 * - Attempt 3: Wait 5 seconds
 * - Attempt 4: Wait 15 seconds
 * - Attempt 5: Wait 30 seconds
 * - After 5 failures: Give up and throw error
 */

class RetryHandler {
  constructor(maxRetries = 5) {
    this.maxRetries = maxRetries;
    this.delays = [0, 1000, 5000, 15000, 30000]; // Milliseconds
  }

  /**
   * Execute a function with automatic retry on failure
   * @param {Function} fn - Async function to execute
   * @param {string} operationName - Name of the operation (for logging)
   * @param {object} options - Retry options
   * @returns {Promise} Result of the function
   */
  async executeWithRetry(fn, operationName = 'API call', options = {}) {
    const {
      maxRetries = this.maxRetries,
      shouldRetry = this._defaultShouldRetry,
      onRetry = null,
    } = options;

    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Execute the function
        const result = await fn();

        // Success!
        if (attempt > 0) {
          console.log(
            `[RetryHandler] ${operationName} succeeded on attempt ${attempt + 1}`
          );
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (!shouldRetry(error, attempt)) {
          console.log(
            `[RetryHandler] ${operationName} failed with non-retryable error:`,
            error.message
          );
          throw error;
        }

        // Check if this was the last attempt
        if (attempt === maxRetries - 1) {
          console.error(
            `[RetryHandler] ${operationName} failed after ${maxRetries} attempts`
          );
          throw error;
        }

        // Calculate delay for this attempt
        const delay = this.delays[attempt] || this.delays[this.delays.length - 1];

        console.warn(
          `[RetryHandler] ${operationName} failed (attempt ${attempt + 1}/${maxRetries}), ` +
          `retrying in ${delay}ms. Error: ${error.message}`
        );

        // Call onRetry callback if provided
        if (onRetry) {
          await onRetry(error, attempt, delay);
        }

        // Wait before retrying
        await this._delay(delay);
      }
    }

    // This should never be reached, but just in case
    throw lastError;
  }

  /**
   * Default logic to determine if an error should be retried
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number
   * @returns {boolean} True if should retry
   */
  _defaultShouldRetry(error, attempt) {
    // Don't retry client errors (4xx except 429)
    if (error.response) {
      const status = error.response.status;

      // Retry rate limit errors (429)
      if (status === 429) {
        return true;
      }

      // Don't retry client errors (400-499)
      if (status >= 400 && status < 500) {
        return false;
      }

      // Retry server errors (500+) and network errors
      return true;
    }

    // Retry network errors
    if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET') {
      return true;
    }

    // Don't retry unknown errors after 3 attempts
    return attempt < 3;
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a retryable version of a function
   * @param {Function} fn - Function to make retryable
   * @param {string} operationName - Name for logging
   * @returns {Function} Wrapped function with retry logic
   */
  wrap(fn, operationName) {
    return async (...args) => {
      return this.executeWithRetry(
        () => fn(...args),
        operationName
      );
    };
  }
}

/**
 * Singleton instance for common use
 */
const defaultRetryHandler = new RetryHandler();

module.exports = RetryHandler;
module.exports.default = defaultRetryHandler;
