const WebSocket = require("ws");
const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");
const { logger } = require("../utils/logger");
const derivConfig = require("../config/deriv-config");
const constants = require("../config/constants");
const tradingEngine = require("./trading-engine");

class DerivWebSocket {
  constructor() {
    this.connection = null;
    this.api = null;
    this.reconnectAttempts = 0;
    this.setupConnection();
  }

  setupConnection() {
    this.connection = new WebSocket(
      `${derivConfig.WS_URL}?app_id=${derivConfig.APP_ID}`
    );

    this.connection.on("open", () => this.handleOpen());
    this.connection.on("close", () => this.handleClose());
    this.connection.on("error", (error) => this.handleError(error));

    this.connection.on("message", (data) => {
      try {
        const parsed = JSON.parse(data);
        tradingEngine.handleTickUpdate(parsed); // Forward messages to trading engine
      } catch (error) {
        logger.error(`Message handling error: ${error.message}`);
      }
    });
    this.api = new DerivAPI({ connection: this.connection });

    // Set the API for trading engine to use
    tradingEngine.setApi(this.api.basic);
  }

  handleOpen() {
    logger.info("WebSocket connected");
    this.reconnectAttempts = 0;

    // Initialize the trading engine after connection is established
    tradingEngine.initialize().catch((err) => {
      logger.error(`Failed to initialize trading engine: ${err.message}`);
    });
  }

  handleClose() {
    logger.warn("WebSocket disconnected");
    if (this.reconnectAttempts < constants.WS_MAX_RECONNECT_ATTEMPTS) {
      setTimeout(() => {
        this.reconnectAttempts++;
        logger.info(`Reconnection attempt ${this.reconnectAttempts}`);
        this.setupConnection();
      }, constants.WS_RECONNECT_DELAY * this.reconnectAttempts);
    }
  }

  handleError(error) {
    logger.error(`WebSocket error: ${error.message}`);
  }

  getApi() {
    return this.api;
  }

  isConnected() {
    return this.connection && this.connection.readyState === WebSocket.OPEN;
  }
}

module.exports = new DerivWebSocket();
