const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { logger } = require("./utils/logger");
const statusRoutes = require("./routes/status");
const tradingEngine = require("./services/trading-engine");
const historicalEngine = require("./services/historical-engine");
const dataRoutes = require("./routes/data");

const app = express();

// Middleware setup (order matters!)
app.use(helmet());
app.use(compression());

// CORS - UNCOMMENTED AND UPDATED
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:5173", // Add your Vite dev server
      "http://localhost:3001", // Common alternative port
      // ACCEPT ALL ORIGINS
      "*",
    ],
    credentials: true,
  })
);

// Body parsing middleware - should come early
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware - only one instance needed
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Custom endpoint for historical data fetch
app.post("/fetch-history", async (req, res) => {
  try {
    await historicalEngine.fetchAllSymbolsHistory();
    res.json({ status: "success", message: "Historical fetch started" });
  } catch (error) {
    logger.error(`Historical fetch error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API routes
app.use("/api/status", statusRoutes);
app.use("/api/data", dataRoutes);

// Catches anything not matched above
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Error handling middleware - must be last
app.use((err, req, res, next) => {
  logger.error(`API Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

module.exports = app;
