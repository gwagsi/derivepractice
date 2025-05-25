 import DerivAPI from "@deriv/deriv-api/dist/DerivAPI.js";
import WebSocket from "ws";
import fs from "fs";

// Application settings
const app_id = 53485;
const connection = new WebSocket(
  `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
);
const basic = new DerivAPI({ connection });
const api = basic.basic;
let mainBalance = { value: 0 };
let times = 0;
// compound factor for stake calculation based on risk level
let compund = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
};

// Cooldown parameters
let inCooldown = false;
let cooldownStartTime = null;
const MAX_TRADES_BEFORE_COOLDOWN = 500;
const COOLDOWN_PERIOD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// State tracking variables
const contractId = { value: null };
const openContractQuote = { quote: null };

const vix10spreviousQuote = { quote: null };
const vix10scurrentQuote = { quote: null };
const vix10previousQuote = { quote: null };
const vix10currentQuote = { quote: null };
const vix100currentQuote = { quote: null };
const vix100previousQuote = { quote: null };
const vix100scurrentQuote = { quote: null };
const vix100spreviousQuote = { quote: null };
const vix25scurrentQuote = { quote: null };
const vix25spreviousQuote = { quote: null };
const vix25currentQuote = { quote: null };
const vix25previousQuote = { quote: null };
const vix50scurrentQuote = { quote: null };
const vix50spreviousQuote = { quote: null };
const vix50currentQuote = { quote: null };
const vix50previousQuote = { quote: null };
const vix75scurrentQuote = { quote: null };
const vix75spreviousQuote = { quote: null };
const vix75currentQuote = { quote: null };
const vix75previousQuote = { quote: null };

// Initialize tracking arrays for each symbol
const ticklimit = [
  {
    symbol: "1HZ10V",
    1: 0.00433,
    2: 0.00405,
    3: 0.0038,
    4: 0.00361,
    5: 0.00344,
  },
  {
    symbol: "R_10",
    1: 0.00613,
    2: 0.00573,
    3: 0.00537,
    4: 0.00511,
    5: 0.00486,
  },
  {
    symbol: "R_25",
    1: 0.01531,
    2: 0.01431,
    3: 0.01342,
    4: 0.01277,
    5: 0.01216,
  },
  {
    symbol: "1HZ25V",
    1: 0.01083,
    2: 0.01012,
    3: 0.00949,
    4: 0.00903,
    5: 0.0086,
  },
  {
    symbol: "R_50",
    1: 0.03063,
    2: 0.02863,
    3: 0.02685,
    4: 0.02554,
    5: 0.02431,
  },
  {
    symbol: "1HZ50V",
    1: 0.02166,
    2: 0.02024,
    3: 0.01898,
    4: 0.01806,
    5: 0.01719,
  },
  {
    symbol: "R_75",
    1: 0.04594,
    2: 0.04294,
    3: 0.04027,
    4: 0.03831,
    5: 0.03647,
  },
  {
    symbol: "1HZ75V",
    1: 0.03249,
    2: 0.03036,
    3: 0.02847,
    4: 0.02709,
    5: 0.02579,
  },
  {
    symbol: "R_100",
    1: 0.06126,
    2: 0.05725,
    3: 0.05369,
    4: 0.05109,
    5: 0.04863,
  },
  {
    symbol: "1HZ100V",
    1: 0.04331,
    2: 0.04048,
    3: 0.03797,
    4: 0.03612,
    5: 0.03438,
  },
];
// Initialize the tick tracking data
const trackArray = [
  {
    symbol: "1HZ10V",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "R_10",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "R_25",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "1HZ25V",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "R_50",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "1HZ50V",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "R_75",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "1HZ75V",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "R_100",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
  {
    symbol: "1HZ100V",
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
];

// Improved trade count tracking by symbol AND risk level
const tradeCount = {};
// Trading flags to trigger subsequent trades after a signal
const tradeFlags = {};

// Initialize trade count and flags for each symbol and risk level
ticklimit.forEach((item) => {
  tradeCount[item.symbol] = {};
  tradeFlags[item.symbol] = {};
  for (let i = 1; i <= 5; i++) {
    tradeCount[item.symbol][i] = 0;
    tradeFlags[item.symbol][i] = false;
  }
});

const tradeCountLimit = 5;

// Function to reset all trade counts and flags
const resetAllTradeCounts = () => {
  Object.keys(tradeCount).forEach((symbol) => {
    Object.keys(tradeCount[symbol]).forEach((risk) => {
      tradeCount[symbol][risk] = 0;
      tradeFlags[symbol][risk] = false;
    });
  });
  console.log("All trade counts and trading flags have been reset.");
};

// Function to track ticks in arrays
const trackTickInArray = (symbol, params) => {
  const MAX_ARRAY_SIZE = 5;
  const withinLimit = params.within_limit;
  const risk = params.risk;
  const symbolObj = trackArray.find((item) => item.symbol === symbol);
  const data = symbolObj[risk];
  const lastElementIndex = data.length - 1;

  if (withinLimit) {
    data[lastElementIndex]++;
  } else {
    // Execute trade if:
    // 1. We just hit a count of 1 (classic signal)
    // 2. OR we have an active trade flag AND we're within the trade count limit
    if (
      data[lastElementIndex] == 1 ||
      (tradeFlags[symbol][risk] && tradeCount[symbol][risk] < tradeCountLimit)
    ) {
      buyContract(symbol, risk);
      tradeCount[symbol][risk]++;

      // If we've reached the trade count limit, reset count and flag
      if (tradeCount[symbol][risk] >= tradeCountLimit) {
        console.log(
          `Trade count limit reached for ${symbol} with risk ${risk}. Resetting trade count and flag.`
        );
        tradeCount[symbol][risk] = 0;
        tradeFlags[symbol][risk] = false;
      }

      if (data[lastElementIndex] == 1) {
        tradeFlags[symbol][risk] = true;
        console.log(
          `Signal detected for ${symbol} with risk ${risk}. Setting trade flag.`
        );
      }
    }

    // If out of limit, start a new element
    if (data.length < MAX_ARRAY_SIZE) {
      // Array has space - add new element
      data.push(0);
    } else {
      // Array is full - remove first element and add new one at the end
      data.shift();
      data.push(0);
    }
  }
};

// User accounts for authentication

// https://www.goo4ewgle.com/?acct1=CR2120738&token1=a1-I9BohmDSVr0QxraZiYSmWjCKTGyjT&cur1=USD&acct2=CR2140975&token2=a1-GkUTni5gyv9m8wJSsS9HRkTr3Wfho&cur2=BTC&acct3=CR2213370&token3=a1-H0mImoA1Zc8uvMBjfmgjahWn4ypXi&cur3=ETH&acct4=CR3216385&token4=a1-6GhkTlcL2ogjVElrcDlCTornVmYHn&cur4=eUSDT&acct5=CR3216403&token5=a1-DWANXNHhaqf4jYsM4nYFWcWpxMAJ5&cur5=LTC&acct6=VRTC3545234&token6=a1-TyqHPoLpfzUAlYMMhPCdlMSKNFJDf&cur6=USD
const user_accounts = [
  {
    account: "CR2120738",
    token: "a1-I9BohmDSVr0QxraZiYSmWjCKTGyjT",
    currency: "USD",
  },
  {
    account: "CR2140975",
    token: "a1-qViFcHQ1GMlymxZJi6v63XuY44Hil",
    currency: "BTC",
  },
  {
    account: "CR2213370",
    token: "a1-KDqBgc57EGPbOF8piLjH4m0LGG7IC",
    currency: "ETH",
  },
  {
    account: "CR3216385",
    token: "a1-UYVMuBUcIJW9lQ0qwWTHG9Str0E9t",
    currency: "eUSDT",
  },
  {
    account: "CR3216403",
    token: "a1-mJuSLLVCt9hKIbBStPbymDDDDd4nC",
    currency: "LTC",
  },
  {
    account: "VRTC3545234",
    token: "a1-a953rMeKZOCexsFC5Xfaf8aVsGD6M",
    currency: "USD",
  },
];

// Helper function to subscribe to various ticks
const subscribeToTicks = async () => {
  await api.ticks({ ticks: "1HZ10V", subscribe: 1 });
  await api.ticks({ ticks: "R_10", subscribe: 1 });
  await api.ticks({ ticks: "R_100", subscribe: 1 });
  await api.ticks({ ticks: "1HZ100V", subscribe: 1 });
  await api.ticks({ ticks: "R_25", subscribe: 1 });
  await api.ticks({ ticks: "1HZ25V", subscribe: 1 });
  await api.ticks({ ticks: "R_50", subscribe: 1 });
  await api.ticks({ ticks: "1HZ50V", subscribe: 1 });
  await api.ticks({ ticks: "R_75", subscribe: 1 });
  await api.ticks({ ticks: "1HZ75V", subscribe: 1 });

  console.log("Subscribed to all tick streams");
};

// Function to handle quote processing and buy signals
const quotesFunction = async (quote, previosequote, tick, tickquote) => {
  if (tickquote === quote) {
    const currentquote = tick;
    if (previosequote.quote !== null) {
      const percentage_change =
        ((currentquote - previosequote.quote) / previosequote.quote) * 100;
      previosequote.quote = currentquote;

      const tickLimitItem = ticklimit.find((item) => item.symbol === quote);
      if (tickLimitItem) {
        for (let i = 1; i <= 2; i++) {
          const limit = tickLimitItem[i];
          // console.log(
          //   `Tick: ${quote}, Risk: ${i}, Percentage Change: ${percentage_change}%, Limit: ${limit} and risk: ${i}`
          // );
          const params = {
            within_limit: Math.abs(percentage_change) <= limit,
            risk: i,
          };
          trackTickInArray(quote, params);
        }
      }
    } else {
      previosequote.quote = currentquote;
    }
  }
};

const buyContract = async (symbolValue, risk) => {
  // Check if we're in cooldown
  if (inCooldown) {
    const currentTime = new Date().getTime();
    const timeElapsed = currentTime - cooldownStartTime;

    if (timeElapsed < COOLDOWN_PERIOD_MS) {
      const timeRemaining = Math.ceil(
        (COOLDOWN_PERIOD_MS - timeElapsed) / 60000
      );
      console.log(
        `In cooldown period (${timeRemaining} minutes remaining). Skipping trade for ${symbolValue} with risk ${risk}.`
      );
      return false;
    } else {
      // Cooldown period has ended
      inCooldown = false;
      times = 0; // Reset the counter
      resetAllTradeCounts(); // Reset all trade counts when cooldown ends
      console.log(
        "Cooldown period ended. Trading resumed with reset counters."
      );
    }
  }

  // Check if we need to enter cooldown after this trade
  if (times >= MAX_TRADES_BEFORE_COOLDOWN) {
    inCooldown = true;
    cooldownStartTime = new Date().getTime();
    console.log(
      `Reached ${MAX_TRADES_BEFORE_COOLDOWN} trades. Entering 15-minute cooldown period.`
    );
  }

  const baseAmount = 1;
  let buyPrice = baseAmount * Math.pow(1 + 0.01 * risk, compund[risk]);

  // Optional: Cap the maximum stake to control risk
  const maxStake = 50;
  buyPrice = Math.min(buyPrice, maxStake);

  // Round to 2 decimal places for currency
  buyPrice = parseFloat(buyPrice.toFixed(2));

  const parameters = {
    contract_type: "ACCU",
    currency: "USD",
    symbol: symbolValue,
    basis: "stake",
    amount: buyPrice,
    app_markup_percentage: 3,
    growth_rate: 0.01 * risk,
    limit_order: {
      take_profit: 0.01,
    },
  };

  try {
    console.log(
      `Attempting to buy contract for ${symbolValue}... (Stake: $${buyPrice} with risk ${risk})`
    );

    const buyObject = {
      buy: 1,
      price: 100,
      parameters: parameters,
    };

    const buyResult = await api.buy(buyObject);
    times++;
    compund[risk] += 1; // Increment compound factor for the risk level
    console.log(
      `Buy successful for ${symbolValue}, times = ${times}, compund = ${compund[risk]}, stake = $${buyPrice}, contract ID: ${buyResult.buy.contract_id}`
    );

    // Log trade counts for this symbol and risk
    console.log(
      `Trade count for ${symbolValue} with risk ${risk}: ${tradeCount[symbolValue][risk]}/${tradeCountLimit}`
    );

    return true;
  } catch (e) {
    console.log(
      `Error buying contract for ${symbolValue}:`,
      e && e.error ? e.error.message : e
    );
    if (e && e.error && e.error.code === "RateLimit") {
      console.log("Rate limit reached, will retry later");
    }
    return false;
  }
};

// Authorize app with user account token
const authorizeApp = async () => {
  console.log("Authorizing application...");
  try {
    const auth = await api.authorize(user_accounts[5].token);
    console.log(
      `Authorized app successfully for account ${auth.authorize.loginid}`
    );
    mainBalance.value = auth.authorize.balance;
    initialBalance.value = auth.authorize.balance; // Set initial balance
    console.log(
      `Account balance: ${mainBalance.value} ${auth.authorize.currency}`
    );
    console.log(
      `Initial balance set to: ${initialBalance.value} ${auth.authorize.currency}`
    );
    return true;
  } catch (error) {
    console.error("Authorization failed:", error?.error?.message || error);
    return false;
  }
};

// Log profit status periodically
const logProfitStatus = () => {
  if (initialBalance.value === 0) return;

  const currentBalance = mainBalance.value;
  const totalProfit = currentBalance - initialBalance.value;
  const totalProfitPercentage = (totalProfit / initialBalance.value) * 100;

  console.log("\n--- PROFIT STATUS UPDATE ---");
  console.log(`Current Balance: $${currentBalance.toFixed(2)}`);
  console.log(`Initial Balance: $${initialBalance.value.toFixed(2)}`);
  console.log(
    `Total Profit: $${totalProfit.toFixed(2)} (${totalProfitPercentage.toFixed(
      2
    )}%)`
  );
  console.log(`Compound Factor: ${JSON.stringify(compund)}`);

  // Log trade counts and flags for all symbols
  console.log("\n--- TRADE COUNT STATUS ---");
  Object.keys(tradeCount).forEach((symbol) => {
    let countStr = `${symbol}: `;
    Object.keys(tradeCount[symbol]).forEach((risk) => {
      // Include flag status in the log
      const flagStatus = tradeFlags[symbol][risk] ? "ACTIVE" : "inactive";
      countStr += `Risk ${risk}: ${tradeCount[symbol][risk]}/${tradeCountLimit} [Flag: ${flagStatus}] | `;
    });
    console.log(countStr);
  });

  console.log("---------------------------\n");
};

// Function to save trade data to a file
const saveTradeData = () => {
  const data = {
    timestamp: new Date().toISOString(),
    balance: mainBalance.value,
    initialBalance: initialBalance.value,
    profit: mainBalance.value - initialBalance.value,
    profitPercentage:
      ((mainBalance.value - initialBalance.value) / initialBalance.value) * 100,
    trades: times,
    compoundFactors: compund,
    tradeCounts: tradeCount,
    tradeFlags: tradeFlags,
    inCooldown: inCooldown,
    cooldownStartTime: cooldownStartTime,
  };

  const jsonData = JSON.stringify(data, null, 2);
  const filename = `trade_data_${new Date()
    .toISOString()
    .replace(/:/g, "-")}.json`;

  fs.writeFile(filename, jsonData, (err) => {
    if (err) {
      console.log("Error writing trade data file", err);
    } else {
      console.log(`Successfully wrote trade data to ${filename}`);
    }
  });
};

// Main initialization function
const initialize = async () => {
  console.log("Initializing Deriv trading bot...");

  const authorized = await authorizeApp();
  if (!authorized) {
    console.error("Exiting due to authorization failure");
    return;
  }

  // Subscribe to balance updates
  await api.balance({ balance: 1, subscribe: 1 });
  console.log("Subscribed to balance updates");

  // Subscribe to transaction updates
  await api.transaction({ transaction: 1, subscribe: 1 });
  console.log("Subscribed to transaction updates");

  // Subscribe to ticks for all symbols
  await subscribeToTicks();

  // Set up periodic profit status logging (every 10 minutes)
  setInterval(logProfitStatus, 10 * 60 * 1000);

  // Save trade data every hour
  setInterval(saveTradeData, 60 * 60 * 1000);
};

// Improved error handling with retry mechanism
const retryOperation = async (operation, maxRetries = 3, delay = 5000) => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      return await operation();
    } catch (err) {
      attempts++;
      console.log(
        `Operation failed, attempt ${attempts}/${maxRetries}. Error: ${err.message}`
      );

      if (attempts >= maxRetries) {
        console.error("Maximum retry attempts reached. Operation failed.");
        throw err;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Retrying operation...");
    }
  }
};

// WebSocket connection event handlers
connection.on("open", () => {
  console.log("Connected to WebSocket server");
  initialize();
});

// Improved error handling in message processing
connection.on("message", async (message) => {
  try {
    const data = JSON.parse(message.toString());

    switch (data.msg_type) {
      case undefined:
        if (data.error) {
          console.log(`Error: ${data.error.message}`);
        }
        break;

      case "balance":
        console.log(
          `Balance update: ${data.balance.balance} ${data.balance.currency}`
        );
        mainBalance.value = data.balance.balance;
        break;

      case "tick":
        const tickquote = data.echo_req.ticks;
        const tick = data.tick.quote;

        // Process quote for all symbols
        quotesFunction("1HZ10V", vix10spreviousQuote, tick, tickquote);
        quotesFunction("R_100", vix100previousQuote, tick, tickquote);
        quotesFunction("1HZ100V", vix100spreviousQuote, tick, tickquote);
        quotesFunction("R_10", vix10previousQuote, tick, tickquote);
        quotesFunction("1HZ25V", vix25spreviousQuote, tick, tickquote);
        quotesFunction("R_25", vix25previousQuote, tick, tickquote);
        quotesFunction("1HZ50V", vix50spreviousQuote, tick, tickquote);
        quotesFunction("R_50", vix50previousQuote, tick, tickquote);
        quotesFunction("1HZ75V", vix75spreviousQuote, tick, tickquote);
        quotesFunction("R_75", vix75previousQuote, tick, tickquote);
        break;

      case "buy":
        console.log(
          `Contract bought: ID ${data.buy?.contract_id || "unknown"}`
        );
        break;

      case "sell":
        console.log(`Contract sold: Profit ${data.sell?.profit || 0}`);
        break;

      case "history":
        console.log("Received historical data");
        const jsonData = JSON.stringify(data.history.prices);
        fs.writeFile("prices.json", jsonData, (err) => {
          if (err) {
            console.log("Error writing file", err);
          } else {
            console.log("Successfully wrote price history to prices.json");
          }
        });
        break;

      default:
        // Uncomment for debugging unknown message types
        // console.log(`Received message type: ${data.msg_type}`);
        break;
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

// Improved reconnection logic
let reconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5 seconds

connection.on("error", (error) => {
  console.error("WebSocket error:", error);
});

connection.on("close", () => {
  console.log("Disconnected from WebSocket server");

  if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempt++;
    const delay = RECONNECT_DELAY * reconnectAttempt;

    console.log(
      `Attempting to reconnect (${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS}) in ${
        delay / 1000
      } seconds...`
    );

    setTimeout(() => {
      console.log("Reconnecting...");
      // Create a new WebSocket connection
      const newConnection = new WebSocket(
        `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
      );

      // Transfer new connection to the existing API
      connection = newConnection;
      basic.connection = newConnection;

      // Re-initialize event handlers
      setupEventHandlers(newConnection);

      // Re-initialize the application when connection is established
      newConnection.onopen = () => {
        console.log("Reconnected to WebSocket server");
        reconnectAttempt = 0; // Reset reconnect attempts counter
        initialize();
      };
    }, delay);
  } else {
    console.error(
      "Maximum reconnection attempts reached. Please restart the application manually."
    );
    process.exit(1);
  }
});

// Setup WebSocket event handlers
const setupEventHandlers = (conn) => {
  // Transfer all event handlers to the new connection
  conn.on("open", () => {
    console.log("Connected to WebSocket server");
    initialize();
  });

  conn.on("message", async (message) => {
    // The existing message handler
    try {
      const data = JSON.parse(message.toString());
      // ... existing message handling logic
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  conn.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
};

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("\nGracefully shutting down...");
  saveTradeData();
  console.log("Final status:");
  logProfitStatus();
  console.log("Closing WebSocket connection...");
  connection.close();
  setTimeout(() => {
    console.log("Shutdown complete.");
    process.exit(0);
  }, 1000);
});

console.log("Starting Deriv trading bot...");
// The connection.on("open") handler will initialize everything once connected
