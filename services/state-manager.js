const { logger } = require("../utils/logger");
const constants = require("../config/constants");

class StateManager {
  constructor() {
    this.state = {
      mainBalance: 0,
      initialBalance: 0,
      times: 0,
      compound: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      inCooldown: false,
      cooldownStartTime: null,
      tradeCount: {},
      tradeFlags: {},
    };
  }

  // Add state management methods here
  getTradeCount() {
    return this.state.times;
  }
}

module.exports = new StateManager();
