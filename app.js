const express = require("express");
const { logger } = require("./utils/logger");
const statusRoutes = require("./routes/status");
const tradingEngine = require("./services/trading-engine");
const historicalEngine = require("./services/historical-engine");

const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/status", statusRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  const status = {
    websocket: tradingEngine.derivWebSocket.isConnected()
      ? "connected"
      : "disconnected",
    tradingEngine: tradingEngine.initialized ? "running" : "not running",
    uptime: process.uptime(),
  };
  res.json(status);
});

app.post("/fetch-history", async (req, res) => {
  try {
    await historicalEngine.fetchAllSymbolsHistory();
    res.json({ status: "success", message: "Historical fetch started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  logger.error(`API Error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
