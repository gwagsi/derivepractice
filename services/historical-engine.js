const { logger } = require("../utils/logger");
const { sleep } = require("../utils/helpers");
const { getCollection } = require("../utils/db");

const constants = require("../config/constants");

// Fix: Import pLimit correctly
const pLimit = require("p-limit").default;

// Add a RateLimiter class to manage API requests
class RateLimiter {
  constructor(maxRequestsPerMinute, maxRequestsPerHour) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.maxRequestsPerHour = maxRequestsPerHour;
    this.minuteRequests = [];
    this.hourRequests = [];
  }

  async waitForQuota() {
    const now = Date.now();

    // Remove requests older than 1 minute
    this.minuteRequests = this.minuteRequests.filter(
      (time) => now - time < 60000
    );

    // Remove requests older than 1 hour
    this.hourRequests = this.hourRequests.filter(
      (time) => now - time < 3600000
    );

    // Check if we're at the minute limit
    if (this.minuteRequests.length >= this.maxRequestsPerMinute) {
      // Calculate time to wait until the oldest request is out of the window
      const oldestMinuteRequest = this.minuteRequests[0];
      const timeToWaitMinute = 60000 - (now - oldestMinuteRequest) + 50; // Add 50ms buffer

      logger.debug(
        `Rate limit reached for minute, waiting ${timeToWaitMinute}ms`
      );
      await sleep(timeToWaitMinute);
      return this.waitForQuota(); // Recursive call to check again after waiting
    }

    // Check if we're at the hour limit
    if (this.hourRequests.length >= this.maxRequestsPerHour) {
      // Calculate time to wait until the oldest request is out of the window
      const oldestHourRequest = this.hourRequests[0];
      const timeToWaitHour = 3600000 - (now - oldestHourRequest) + 50; // Add 50ms buffer

      logger.debug(`Rate limit reached for hour, waiting ${timeToWaitHour}ms`);
      await sleep(timeToWaitHour);
      return this.waitForQuota(); // Recursive call to check again after waiting
    }

    // Add the current request to both windows
    this.minuteRequests.push(now);
    this.hourRequests.push(now);
  }

  // Method to track a request that was just made
  trackRequest() {
    const now = Date.now();
    this.minuteRequests.push(now);
    this.hourRequests.push(now);
  }

  // Get remaining quota information for monitoring
  getRemainingQuota() {
    const now = Date.now();

    // Clean up expired timestamps first
    this.minuteRequests = this.minuteRequests.filter(
      (time) => now - time < 60000
    );
    this.hourRequests = this.hourRequests.filter(
      (time) => now - time < 3600000
    );

    return {
      minuteRemaining: this.maxRequestsPerMinute - this.minuteRequests.length,
      hourRemaining: this.maxRequestsPerHour - this.hourRequests.length,
    };
  }
}

class HistoricalDataEngine {
  constructor() {
    this.MAX_RETRIES = 3;
    this.BATCH_SIZE = 5000; // Max allowed by API
    this.MIN_DELAY = 100; // Minimum delay between requests (ms)
    this.MAX_DELAY = 1000; // Maximum delay cap (ms)
    this.api = null;
    this.metrics = {
      requests: 0,
      inserts: 0,
      startTime: Date.now(),
    };

    // Create a rate limiter for general requests (220/min, 14400/hour)
    this.rateLimiter = new RateLimiter(75, 3500); // Set slightly below limits to be safe

    this.symbolConcurrency = 2; // Reduced from 3 to avoid rate limit issues
    this.currentBatchSize = this.BATCH_SIZE;

    this.isProcessing = false;
    this.processingProgress = {
      completed: 0,
      total: 0,
      percentage: 0,
      status: "idle",
      startTime: null,
      endTime: null,
      errors: [],
    };
  }

  setApi(api) {
    this.api = api;
  }

  async fetchHistoricalTicks(symbol) {
    try {
      const oneYearAgo = Math.floor(Date.now() / 1000) - 31536000; // 365 days
      let endTime = "latest";
      let attempts = 0;
      let hasMoreData = true;
      let totalInserted = 0;

      // Initialize adaptive batch sizing
      let currentBatchSize = this.BATCH_SIZE;
      const batchQueue = [];
      const MAX_CONCURRENT_BATCHES = 2; // Reduced from 3 to avoid memory issues

      while (hasMoreData && attempts < this.MAX_RETRIES) {
        try {
          // Wait for rate limit quota before making a request
          await this.rateLimiter.waitForQuota();

          const requestStart = Date.now();

          // Fetch batch with current parameters
          const response = await this.api.ticksHistory({
            ticks_history: symbol,
            style: "ticks",
            adjust_start_time: 1,
            count: currentBatchSize,
            start: oneYearAgo,
            end: endTime,
          });

          // Track the request in rate limiter and metrics
          this.rateLimiter.trackRequest();
          this.metrics.requests++;

          const requestDuration = Date.now() - requestStart;

          // Log rate limit information
          const quota = this.rateLimiter.getRemainingQuota();
          logger.debug(
            `Rate limit remaining: ${quota.minuteRemaining}/min, ${quota.hourRemaining}/hour`
          );

          if (response.error) {
            // Check for rate limit errors specifically
            if (response.error.code === "RateLimit") {
              logger.warn(`Rate limit hit for ${symbol}, backing off`);
              await sleep(30000); // 30 second backoff
              continue; // Retry without incrementing attempt counter
            }
            throw new Error(`API Error: ${response.error.message}`);
          }

          const newTicks = this.combineTickData(response.history);

          logger.debug(
            `Fetched ${newTicks.length} ticks for ${symbol} [Batch: ${currentBatchSize}]`
          );

          if (newTicks.length > 0) {
            // Queue save operation without awaiting immediately
            const savePromise = this.saveToMongo(symbol, newTicks)
              .then((result) => (totalInserted += result.insertedCount))
              .catch((e) =>
                logger.error(`Save failed for ${symbol}: ${e.message}`)
              );

            batchQueue.push(savePromise);

            // Process batches concurrently
            if (batchQueue.length >= MAX_CONCURRENT_BATCHES) {
              await Promise.all(batchQueue);
              batchQueue.length = 0;
            }

            // Update end time from the earliest tick
            endTime = newTicks[0].epoch - 1;

            // Check history limit
            if (newTicks[0].epoch <= oneYearAgo) {
              hasMoreData = false;
            }
          } else {
            hasMoreData = false;
          }

          // Reset attempts after successful request
          attempts = 0;

          // Adaptive delay based on API response time and remaining quota
          // The closer we are to the rate limit, the longer we'll wait
          const quotaPercentage =
            quota.minuteRemaining / this.rateLimiter.maxRequestsPerMinute;
          const adaptiveDelay = Math.max(
            this.MIN_DELAY,
            this.MAX_DELAY * (1 - quotaPercentage)
          );

          await sleep(adaptiveDelay);
        } catch (error) {
          console.log(error);
          logger.error(
            `Attempt ${attempts + 1} failed for ${symbol}: ${error.message}`
          );

          if (++attempts >= this.MAX_RETRIES) {
            logger.error(`Max retries reached for ${symbol}`);
            throw error;
          }

          // Exponential backoff with jitter
          const delay = Math.min(
            30000,
            1000 * Math.pow(2, attempts) + Math.random() * 500
          );

          await sleep(delay);
        }
      }

      // Process remaining batches
      if (batchQueue.length > 0) {
        await Promise.all(batchQueue);
      }

      logger.info(`Completed ${symbol}. Total inserted: ${totalInserted}`);
      return totalInserted;
    } catch (error) {
      logger.error(`Critical failure for ${symbol}: ${error.stack}`);
      throw error;
    }
  }

  // Rest of the methods remain the same
  combineTickData(history) {
    if (!history?.times?.length || !history?.prices?.length) return [];

    const tickCount = history.times.length;
    const ticks = new Array(tickCount);

    for (let i = 0; i < tickCount; i++) {
      ticks[i] = {
        epoch: history.times[i],
        price: history.prices[i],
      };
    }

    return ticks;
  }

  async saveToMongo(symbol, ticks) {
    try {
      const collection = getCollection(symbol);
      let totalInserted = 0;

      const result = await collection.insertMany(ticks, {
        ordered: false, // Continue inserting even if some fail
      });
      // Track inserted documents
      if (result && result.upsertedCount) {
        totalInserted += result.upsertedCount;
      }

      // Return an object with insertedCount property
      return { insertedCount: totalInserted };
    } catch (error) {
      logger.error(`Critical save error for ${symbol}: ${error.stack}`);
      throw error; // Propagate to retry mechanism
    }
  }

  processTicks(symbol, ticks) {
    // Add your analysis logic here
    return {
      symbol,
      count: ticks.length,
      firstTick: ticks[0],
      lastTick: ticks[ticks.length - 1],
    };
  }

  async processHistory() {
    // Fix: Create a limit function by calling pLimit with the concurrency value
    const limit = pLimit(this.symbolConcurrency);
    const symbols = constants.TICK_SYMBOLS;

    // Add progress tracking
    let completed = 0;
    const total = symbols.length;

    await Promise.all(
      symbols.map((symbol) =>
        limit(async () => {
          try {
            await this.fetchHistoricalTicks(symbol);
            completed++;
            logger.info(
              `Progress: ${completed}/${total} (${Math.round(
                (completed / total) * 100
              )}%)`
            );
          } catch (e) {
            logger.error(`Symbol ${symbol} failed: ${e.message}`);
          }
        })
      )
    );
  }

  async fetchAllSymbolsHistory() {
    // If already processing, don't start again
    if (this.isProcessing) {
      return {
        status: "in_progress",
        message: "Historical data fetching already in progress",
        progress: this.processingProgress,
      };
    }

    // Start the background processing
    this.isProcessing = true;
    this.processingProgress = {
      completed: 0,
      total: constants.TICK_SYMBOLS.length,
      percentage: 0,
      status: "starting",
      startTime: new Date(),
      endTime: null,
      errors: [],
      rateLimitInfo: {
        // Add rate limit tracking to progress
        minuteQuota: 0,
        hourQuota: 0,
      },
    };

    // Start process in background
    this.processHistoryInBackground();

    // Immediately return status
    return {
      status: "started",
      message: "Historical data fetching started in background",
      progress: this.processingProgress,
    };
  }

  // Add a new method to process history in the background
  async processHistoryInBackground() {
    try {
      logger.info("Starting background historical data fetch");
      this.processingProgress.status = "processing";

      const limit = pLimit(this.symbolConcurrency);
      const symbols = constants.TICK_SYMBOLS;
      const total = symbols.length;

      // Process all symbols concurrently with limits
      await Promise.all(
        symbols.map((symbol) =>
          limit(async () => {
            try {
              await this.fetchHistoricalTicks(symbol);
              this.processingProgress.completed++;
              this.processingProgress.percentage = Math.round(
                (this.processingProgress.completed / total) * 100
              );

              // Update rate limit info in progress
              const quota = this.rateLimiter.getRemainingQuota();
              this.processingProgress.rateLimitInfo = {
                minuteQuota: quota.minuteRemaining,
                hourQuota: quota.hourRemaining,
              };

              logger.info(
                `Progress: ${this.processingProgress.completed}/${total} (${this.processingProgress.percentage}%) [Rate limits: ${quota.minuteRemaining}/min, ${quota.hourRemaining}/hour]`
              );
            } catch (e) {
              logger.error(`Symbol ${symbol} failed: ${e.message}`);
              this.processingProgress.errors.push({
                symbol,
                error: e.message,
                time: new Date(),
              });
            }
          })
        )
      );

      this.processingProgress.status = "completed";
      this.processingProgress.endTime = new Date();
      logger.info("Background historical data fetch completed");
    } catch (error) {
      this.processingProgress.status = "failed";
      this.processingProgress.endTime = new Date();
      this.processingProgress.errors.push({
        error: error.message,
        time: new Date(),
      });
      logger.error(`Background processing failed: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  // Get current status with rate limit info
  getProcessingStatus() {
    if (this.isProcessing) {
      // Update rate limit info before returning
      const quota = this.rateLimiter.getRemainingQuota();
      this.processingProgress.rateLimitInfo = {
        minuteQuota: quota.minuteRemaining,
        hourQuota: quota.hourRemaining,
      };
    }

    return {
      isProcessing: this.isProcessing,
      progress: this.processingProgress,
    };
  }
}

module.exports = new HistoricalDataEngine();
