// config/constants.js
module.exports = {
  COOLDOWN_PERIOD_MS: 15 * 60 * 1000,
  MAX_TRADES_BEFORE_COOLDOWN: 500,
  TRADE_COUNT_LIMIT: 5,
  WS_RECONNECT_DELAY: 5000,
  WS_MAX_RECONNECT_ATTEMPTS: 10,

  TICK_SYMBOLS: [
    "R_10",
    "1HZ100V",
    "R_100",
    "1HZ25V",
    "R_25",
    "1HZ50V",
    "R_50",
    "1HZ75V",
    "R_75",
    "1HZ10V",
  ],
};
