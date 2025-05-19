const { logger } = require("../utils/logger");
const stateManager = require("./state-manager");
const derivWebSocket = require("./deriv-websocket");
const { sleep } = require("../utils/helpers");
const { getCollection } = require("../utils/db");

const constants = require("../config/constants");

// Fix: Import pLimit correctly
const pLimit = require("p-limit").default;

class HistoricalDataEngine {
  constructor() {
    this.MAX_RETRIES = 3;
    this.BATCH_SIZE = 5000; // Max allowed by API
    this.DELAY_BETWEEN_REQUESTS = 0; // 1 second
    this.MIN_DELAY = 0; // Minimum delay between requests
    this.MAX_DELAY = 50; // Maximum delay cap
    this.metrics = {
      // Initialize metrics object
      requests: 0,
      inserts: 0,
      startTime: Date.now(),
    };

    this.symbolConcurrency = 3;
    // Initialize currentBatchSize in constructor
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
      const MAX_CONCURRENT_BATCHES = 3;

      while (hasMoreData && attempts < this.MAX_RETRIES) {
        try {
          const requestStart = Date.now();

          // Fetch batch with current parameters
          const response = await derivWebSocket.getApi().basic.ticksHistory({
            ticks_history: symbol,
            style: "ticks",
            adjust_start_time: 1,
            count: currentBatchSize,
            start: oneYearAgo,
            end: endTime,
          });

          this.metrics.requests++;
          const requestDuration = Date.now() - requestStart;

          if (response.error) {
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

          // Adaptive delay based on API response time
          const delay = Math.max(this.MIN_DELAY, this.MAX_DELAY);

          await sleep(delay);
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

  // Updated combineTickData with memory optimization
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

              logger.info(
                `Progress: ${this.processingProgress.completed}/${total} (${this.processingProgress.percentage}%)`
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

  // Add a method to get current status
  getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      progress: this.processingProgress,
    };
  }
}

module.exports = new HistoricalDataEngine();
