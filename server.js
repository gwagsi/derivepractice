require("dotenv").config();
const app = require("./app");
const { logger } = require("./utils/logger");
const tradingEngine = require("./services/trading-engine");
const derivWebSocket = require("./services/deriv-websocket");
const historicalEngine = require("./services/historical-engine");

const { connect } = require("./utils/db");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  try {
    await connect();
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`);
    process.exit(1);
  }
  //   try {
  //     await tradingEngine.initialize();
  //   } catch (error) {
  //     logger.error(`Failed to initialize trading engine: ${error.message}`);
  //   }
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
