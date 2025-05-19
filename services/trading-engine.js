const { logger } = require("../utils/logger");
const stateManager = require("./state-manager");
const constants = require("../config/constants");

class TradingEngine {
  constructor() {
    this.api = null;
    this.initialized = false;
  }

  setApi(api) {
    this.api = api;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.authorize();
      await this.subscribeToData();
      this.initialized = true;
      logger.info("Trading engine initialized");
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
    }
  }

  async authorize() {
    console.log("Authorizing application...");
    try {
      // Parse the USER_ACCOUNTS environment variable as JSON
      let user_accounts = [];

      try {
        // Make sure to handle potential JSON parsing errors
        const accountsStr = process.env.USER_ACCOUNTS;
        console.log("USER_ACCOUNTS:", accountsStr); // Log for debugging
        if (accountsStr) {
          user_accounts = JSON.parse(accountsStr);
          // Log for debugging
          console.log("Parsed user accounts:", user_accounts);
        }
      } catch (parseError) {
        console.error("Error parsing USER_ACCOUNTS:", parseError);
        throw new Error(
          "Invalid USER_ACCOUNTS format in environment variables"
        );
      }

      if (!user_accounts || user_accounts.length === 0) {
        throw new Error("No user accounts found.");
      }

      const { account, token } = user_accounts[0];
      if (!token) {
        throw new Error("No valid token found in the first user account");
      }

      const auth = await this.api.authorize(token);
      console.log(
        `Authorized app successfully for account ${auth.authorize.loginid}`
      );

      // Check if these variables exist before setting them
      if (typeof mainBalance !== "undefined") {
        mainBalance.value = auth.authorize.balance;
      }

      if (typeof initialBalance !== "undefined") {
        initialBalance.value = auth.authorize.balance; // Set initial balance
        console.log(
          `Initial balance set to: ${initialBalance.value} ${auth.authorize.currency}`
        );
      }

      console.log(
        `Account balance: ${auth.authorize.balance} ${auth.authorize.currency}`
      );

      return true;
    } catch (error) {
      console.error("Authorization failed:", error);
      throw error; // Rethrow to be caught by initialize()
    }
  }

  async subscribeToData() {
    // Subscribe to balance updates
    await this.api.balance({ balance: 1, subscribe: 1 });
    console.log("Subscribed to balance updates");

    // Subscribe to transaction updates
    await this.api.transaction({ transaction: 1, subscribe: 1 });
    console.log("Subscribed to transaction updates");

    // Subscribe to ticks for all symbols
    // await this.subscribeToTicks();
  }

  async subscribeToTicks() {
    try {
      logger.info("Subscribing to tick streams...");

      // Use the symbols from constants
      for (const symbol of constants.TICK_SYMBOLS) {
        await this.api.ticks({
          ticks: symbol,
          subscribe: 1,
        });
      }

      logger.info("Successfully subscribed to all tick streams");
    } catch (error) {
      logger.error(`Tick subscription failed: ${error.message}`);
      throw error;
    }
  }

  // Add your trading logic methods here
  handleTickUpdate(data) {
    // Process tick data
    if (data && data.tick) {
      console.log(`Received tick for ${data.tick.symbol}: ${data.tick.quote}`);
      // Implement your trading strategy here
    }
  }
}

module.exports = new TradingEngine();
