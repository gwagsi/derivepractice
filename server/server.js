require("dotenv").config();
const app = require("./app");
const { logger } = require("./utils/logger");
const derivWebSocket = require("./services/deriv-websocket");
const analysisEngine = require("./services/analysis-engine");
const constants = require("./config/constants");

const { connect } = require("./utils/db");

const PORT = process.env.PORT || 3000;

/**
 * Process symbols in batches with limited concurrency
 * @param {Array<string>} symbols - List of symbols to process
 * @param {number} concurrency - Maximum number of concurrent processes
 */
async function processBatchesWithConcurrency(symbols, concurrency = 3) {
  const total = symbols.length;
  let processed = 0;
  let batchNum = 0;

  logger.info(
    `Starting batch processing with concurrency ${concurrency} for ${total} symbols`
  );

  while (processed < total) {
    const batchSymbols = symbols.slice(processed, processed + concurrency);
    const batchSize = batchSymbols.length;

    batchNum++;
    logger.info(`Processing batch #${batchNum} with ${batchSize} symbols`);

    try {
      const batchPromises = batchSymbols.map(async (symbol) => {
        try {
          logger.info(`Initializing analysis engine for symbol: ${symbol}`);
          const analysisEngineInstance = new analysisEngine(symbol);
          await analysisEngineInstance.initialize();
          return analysisEngineInstance.analyzeSymbol();
        } catch (error) {
          logger.error(`Error processing symbol ${symbol}: ${error.message}`);
          throw error;
        }
      });

      await Promise.all(batchPromises);
      processed += batchSize;
      logger.info(`Progress: Processed ${processed} out of ${total} symbols`);
    } catch (error) {
      logger.error(`Batch #${batchNum} failed: ${error.message}`);
      processed += batchSize; // Skip failed batch
    }
  }

  logger.info(`Completed processing all ${total} symbols`);
}

const server = app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  try {
    await connect();
    logger.info("Connected to MongoDB");

    derivWebSocket.setupConnection();

    // Process symbols with concurrency of 3
    // await processBatchesWithConcurrency(constants.NEW_SYMBOLS, 3);
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`);
    process.exit(1);
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down gracefully...");

  // Close WebSocket connection
  if (derivWebSocket.connection) {
    derivWebSocket.connection.close();
  }

  // Close HTTP server
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force close after timeout
  setTimeout(() => {
    logger.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
