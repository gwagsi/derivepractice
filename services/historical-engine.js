const { logger } = require("../utils/logger");
const stateManager = require("./state-manager");
const derivWebSocket = require("./deriv-websocket");
const { sleep } = require("../utils/helpers");
const { getCollection } = require("../utils/db");

const constants = require("../config/constants");

class HistoricalDataEngine {
  constructor() {
    this.MAX_RETRIES = 3;
    this.BATCH_SIZE = 5000; // Max allowed by API
    this.DELAY_BETWEEN_REQUESTS = 0; // 1 second
  }

  async fetchHistoricalTicks(symbol) {
    try {
      const oneYearAgo = Math.floor(Date.now() / 1000) - 35536000; // 1 year in seconds
      let endTime = "latest";

      let attempts = 0;
      let hasMoreData = true;

      while (hasMoreData && attempts < this.MAX_RETRIES) {
        const response = await derivWebSocket.getApi().basic.ticksHistory({
          ticks_history: symbol,
          style: "ticks",
          adjust_start_time: 1,
          count: this.BATCH_SIZE,
          start: oneYearAgo,
          end: endTime,
        });

        if (response.error) {
          logger.error(`API Error: ${response.error.message}`);
          attempts++;
          await sleep(this.DELAY_BETWEEN_REQUESTS * attempts);
          continue;
        }

        const newTicks = this.combineTickData(response.history);
        console.log(
          `Fetched ${newTicks.length} ticks for ${symbol} with new end time ${endTime}`
        );
        if (newTicks.length > 0) {
          // Set next end time to the earliest received timestamp - 1 second
          endTime = newTicks[0].epoch - 1;
          this.saveToMongo(symbol, newTicks);

          // Check if we've reached our history limit
          if (newTicks[0].epoch <= oneYearAgo) {
            hasMoreData = false;
          }
        } else {
          hasMoreData = false;
        }

        // Reset attempts after successful request
        attempts = 0;
        await sleep(this.DELAY_BETWEEN_REQUESTS);
      }

      return;
    } catch (error) {
      logger.error(`Failed to fetch history for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  async saveToMongo(symbol, ticks) {
    try {
      const collection = getCollection(symbol);
      const documents = ticks.map((tick) => ({
        price: tick.price,
        timestamp: new Date(tick.epoch * 1000),
      }));

      const result = await collection.insertMany(documents);
      logger.info(`Inserted ${result.insertedCount} ticks for ${symbol}`);
      return result;
    } catch (error) {
      logger.error(`MongoDB save error: ${error.message}`);
      throw error;
    }
  }
  combineTickData(history) {
    if (!history || !history.times || !history.prices) return [];
    return history.times.map((epoch, index) => ({
      epoch,
      price: history.prices[index],
    }));
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
    const symbols = constants.TICK_SYMBOLS;
    for (const symbol of symbols) {
      try {
        logger.info(`Fetching history for ${symbol}`);
        await this.fetchHistoricalTicks(symbol);
      } catch (error) {
        logger.error(`Failed to process ${symbol}: ${error.message}`);
      }
    }
  }

  async fetchAllSymbolsHistory() {
    this.processHistory();
  }
}

module.exports = new HistoricalDataEngine();
