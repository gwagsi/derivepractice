const { logger } = require("../utils/logger");
const { getCollection } = require("../utils/db");
const { sleep } = require("../utils/helpers");
const constants = require("../config/constants");

/**
 * Analysis Engine
 *
 * This class performs analysis on historical tick data stored in the database.
 * It can analyze a single symbol and save the analysis results back to the database.
 */
class AnalysisEngine {
  constructor(symbol) {
    this.symbol = symbol;
    this.initialized = false;
    this.tickLimit = constants.TICK_LIMITS.find(
      (item) => item.symbol === symbol
    );
    this.symbolObj = constants.TRACK_ARRAY.find(
      (item) => item.symbol === symbol
    );
    this.tickLimitCount = constants.TICK_COUNT_LIMIT[symbol];

    // Performance tracking
    this.totalProcessingTime = 0;
    this.ticksProcessed = 0;
    this.maxTickTime = 0;
    this.minTickTime = Infinity;

    // Batch operation buffers - a key improvement
    this.batchBuffer = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    // Configuration for batch operations
    this.batchSize = 500; // Number of documents to accumulate before bulk write
    this.flushInterval = 10000; // Time in ms to force flush buffers even if not full
    this.lastFlushTime = Date.now();
  }

  async initialize() {
    if (this.initialized) {
      logger.warn("Analysis engine already initialized");
      return;
    }

    try {
      this.initialized = true;
      logger.info("Analysis engine initialized");
    } catch (error) {
      logger.error(`Analysis engine initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main method to analyze historical data for a single symbol
   * @returns {Object} - Analysis results and statistics
   */
  async analyzeSymbol() {
    if (!this.initialized) await this.initialize();

    try {
      logger.info(`Starting analysis for symbol: ${this.symbol}`);
      const collection = getCollection(this.symbol);
      const totalTicks = await collection.countDocuments();

      if (totalTicks === 0) {
        logger.warn(`No historical data found for symbol: ${this.symbol}`);
        return { success: false, message: "No data found" };
      }

      logger.info(`Found ${totalTicks} ticks for ${this.symbol}`);

      const oldestTick = await collection
        .find()
        .sort({ epoch: 1 })
        .limit(1)
        .toArray();
      const newestTick = await collection
        .find()
        .sort({ epoch: -1 })
        .limit(1)
        .toArray();
      const startTime = oldestTick[0].epoch;
      const endTime = newestTick[0].epoch;

      logger.info(
        `Data range: ${new Date(startTime * 1000).toISOString()} to ${new Date(
          endTime * 1000
        ).toISOString()}`
      );

      let currentEpoch = startTime;
      const batchSize = 10000;
      let previousQuote = null;
      let batchCount = 0;

      // Performance tracking variables
      const performanceTrackInterval = 1000; // Log performance every 1000 ticks
      const startAnalysisTime = process.hrtime.bigint();

      // Separate timing for analysis logic vs DB operations
      let totalAnalysisCoreTimeMs = 0;
      let totalDBOperationTimeMs = 0;

      try {
        while (currentEpoch <= endTime) {
          const tickBatch = await collection
            .find({ epoch: { $gte: currentEpoch } })
            .sort({ epoch: 1 })
            .limit(batchSize)
            .toArray();

          if (tickBatch.length === 0) break;
          currentEpoch = tickBatch[tickBatch.length - 1].epoch + 1;

          for (const tick of tickBatch) {
            // Only time the core analysis logic, not the DB operations
            const tickStartTime = process.hrtime.bigint();

            const currentQuote = tick.price;
            batchCount++;

            if (previousQuote !== null) {
              const percentageChange =
                ((currentQuote - previousQuote) / previousQuote) * 100;

              // Core analysis: Determine which limits are exceeded
              const analysisResults = [];
              for (let riskLevel = 1; riskLevel <= 5; riskLevel++) {
                const limit = this.tickLimit[riskLevel];
                const within_limit = Math.abs(percentageChange) <= limit;
                analysisResults.push({ within_limit, risk: riskLevel });
              }

              // Stop timing for core analysis
              const analysisEndTime = process.hrtime.bigint();
              const analysisTimeNs = Number(analysisEndTime - tickStartTime);
              const analysisTimeMs = analysisTimeNs / 1_000_000;

              // Update performance metrics for core analysis
              this.ticksProcessed++;
              this.totalProcessingTime += analysisTimeMs;
              this.maxTickTime = Math.max(this.maxTickTime, analysisTimeMs);
              this.minTickTime = Math.min(this.minTickTime, analysisTimeMs);
              totalAnalysisCoreTimeMs += analysisTimeMs;

              // Separately time the DB operations
              const dbStartTime = process.hrtime.bigint();

              // Process results and prepare for DB operations (with batching)
              for (const result of analysisResults) {
                this.trackTickInArray(result);
              }

              // Check if it's time to flush buffers to database
              const currentTime = Date.now();
              if (currentTime - this.lastFlushTime > this.flushInterval) {
                const flushStartTime = process.hrtime.bigint();
                await this.flushAllBuffers();
                this.lastFlushTime = currentTime;
                const flushEndTime = process.hrtime.bigint();
                const flushTimeNs = Number(flushEndTime - flushStartTime);
                const flushTimeMs = flushTimeNs / 1_000_000;
                totalDBOperationTimeMs += flushTimeMs;
              }

              const dbEndTime = process.hrtime.bigint();
              const dbTimeNs = Number(dbEndTime - dbStartTime);
              const dbTimeMs = dbTimeNs / 1_000_000;
              totalDBOperationTimeMs += dbTimeMs;
            } else {
              // For the first tick, there's no analysis, just record the price
              previousQuote = currentQuote;
              this.ticksProcessed++;
            }

            previousQuote = currentQuote;

            if (batchCount % performanceTrackInterval === 0) {
              const avgTickTime =
                this.totalProcessingTime / this.ticksProcessed;
              const avgDBTime = totalDBOperationTimeMs / this.ticksProcessed;

              logger.info(
                `Analyzed ${batchCount} ticks for ${this.symbol}. ` +
                  `Avg core analysis time: ${avgTickTime.toFixed(3)}ms, ` +
                  `Min: ${this.minTickTime.toFixed(3)}ms, ` +
                  `Max: ${this.maxTickTime.toFixed(3)}ms, ` +
                  `Avg DB operation time: ${avgDBTime.toFixed(3)}ms`
              );
            }
          }

          await sleep(10);
        }
      } finally {
        // Make sure to flush any remaining items in the buffers
        const finalFlushStart = process.hrtime.bigint();
        await this.flushAllBuffers();
        const finalFlushEnd = process.hrtime.bigint();
        const finalFlushTimeNs = Number(finalFlushEnd - finalFlushStart);
        const finalFlushTimeMs = finalFlushTimeNs / 1_000_000;
        totalDBOperationTimeMs += finalFlushTimeMs;
      }

      // Calculate overall performance metrics
      const endAnalysisTime = process.hrtime.bigint();
      const totalAnalysisTimeMs =
        Number(endAnalysisTime - startAnalysisTime) / 1_000_000;
      const avgCoreTickTime = this.totalProcessingTime / this.ticksProcessed;
      const avgDBOpTime = totalDBOperationTimeMs / this.ticksProcessed;

      logger.info(
        `Analysis completed for ${this.symbol}. ` +
          `Total ticks processed: ${this.ticksProcessed}, ` +
          `Total time: ${totalAnalysisTimeMs.toFixed(2)}ms, ` +
          `Avg core analysis time: ${avgCoreTickTime.toFixed(3)}ms, ` +
          `Min core time: ${this.minTickTime.toFixed(3)}ms, ` +
          `Max core time: ${this.maxTickTime.toFixed(3)}ms, ` +
          `Avg DB operation time: ${avgDBOpTime.toFixed(3)}ms`
      );

      return {
        success: true,
        symbol: this.symbol,
        resultsSaved: true,
        performance: {
          totalTicks: this.ticksProcessed,
          totalCoreProcessingTimeMs: this.totalProcessingTime,
          totalDBOperationTimeMs: totalDBOperationTimeMs,
          avgCoreTickTimeMs: avgCoreTickTime,
          avgDBOperationTimeMs: avgDBOpTime,
          minCoreTickTimeMs: this.minTickTime,
          maxCoreTickTimeMs: this.maxTickTime,
        },
      };
    } catch (error) {
      logger.error(`Analysis failed for ${this.symbol}: ${error.stack}`);
      return { success: false, symbol: this.symbol, error: error.message };
    }
  }

  /**
   * Track tick data changes without immediate database writes
   */
  trackTickInArray({ within_limit, risk }) {
    const data = this.symbolObj[risk];
    const lastElementIndex = data.length - 1;

    if (within_limit) {
      // Count consecutive ticks within limit
      data[lastElementIndex]++;
    } else {
      // When a tick breaks the limit, save the streak and reset
      this.tickLimitCount[risk - 1]++;
      const dataToSave = {
        id: this.tickLimitCount[risk - 1],
        count: data[lastElementIndex],
      };
      data[lastElementIndex] = 0;

      // Instead of immediate DB write, add to batch buffer
      this.batchBuffer[risk].push(dataToSave);

      // If batch size threshold reached, trigger a flush for this risk level
      if (this.batchBuffer[risk].length >= this.batchSize) {
        // Use process.nextTick to avoid blocking the main thread but ensure eventual write
        process.nextTick(() => {
          this.flushBuffer(risk);
        });
      }
    }
  }

  /**
   * Flush a specific risk level buffer to MongoDB
   */
  async flushBuffer(risk) {
    if (this.batchBuffer[risk].length === 0) return; // Nothing to flush

    const collectionName = risk + "_ticks_" + this.symbol;
    const collection = getCollection(collectionName);

    try {
      // Copy the buffer and clear it immediately to prevent data loss
      const bufferToWrite = [...this.batchBuffer[risk]];
      this.batchBuffer[risk] = [];

      // Perform a bulk write instead of individual inserts
      if (bufferToWrite.length > 0) {
        const bulkOps = bufferToWrite.map((doc) => ({
          insertOne: { document: doc },
        }));

        const result = await collection.bulkWrite(bulkOps, { ordered: false });

        logger.debug(
          `Bulk write for ${this.symbol} risk ${risk}: ` +
            `Inserted ${result.insertedCount} documents`
        );

        return result;
      }
    } catch (error) {
      logger.error(
        `Error in bulk write for ${this.symbol} risk ${risk}: ${error.stack}`
      );

      // Consider implementing a retry mechanism or error queue here
      // For now, let's log and continue
    }
  }

  /**
   * Flush all buffers for all risk levels
   */
  async flushAllBuffers() {
    const flushPromises = [];

    for (let risk = 1; risk <= 5; risk++) {
      flushPromises.push(this.flushBuffer(risk));
    }

    await Promise.all(flushPromises);
  }

  /**
   * Legacy method for individual document saving - kept for reference
   * This is no longer used directly but is available if needed
   */
  async saveToMongo(data, risk) {
    try {
      const collectionName = risk + "_ticks_" + this.symbol;
      const collection = getCollection(collectionName);

      const result = await collection.insertOne(data);

      // Return an object with insertedCount property
      return { insertedCount: result.insertedCount };
    } catch (error) {
      logger.error(`Critical save error for ${this.symbol}: ${error.stack}`);
      throw error; // Propagate to retry mechanism
    }
  }
}

module.exports = AnalysisEngine;
