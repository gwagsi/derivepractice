// routes/status.js
const express = require("express");
const { logger } = require("../utils/logger");
const stateManager = require("../services/state-manager");

const router = express.Router();

router.get("/trades", (req, res) => {
  res.json({
    totalTrades: stateManager.getTradeCount(),
    activeSymbols: stateManager.getActiveSymbols(),
    cooldownStatus: stateManager.getCooldownStatus(),
  });
});

module.exports = router;
