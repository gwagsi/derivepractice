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
let initialBalance = { value: 0 }; // Track initial balance for profit calculations
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
    if (data[lastElementIndex] == 1) {
      buyContract(symbol, risk);
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
const user_accounts = [
  {
    account: "CR2120738",
    token: "a1-vvMUvED66toIVgw9ERFyXKxZ4Q6Kj",
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
        `In cooldown period (${timeRemaining} minutes remaining). Skipping trade for ${symbolValue}.`
      );
      return false;
    } else {
      // Cooldown period has ended
      inCooldown = false;
      times = 0; // Reset the counter
      console.log("Cooldown period ended. Trading resumed with reset counter.");
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

  const baseAmount = 2;
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
  console.log(`Compound Factor: ${compund}`);
  console.log("---------------------------\n");
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
  // setInterval(logProfitStatus, 10 * 60 * 1000);
};

// WebSocket connection event handlers
connection.on("open", () => {
  console.log("Connected to WebSocket server");
  initialize();
});

connection.on("message", async (message) => {
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
      console.log(`Contract bought:`);
      break;

    case "sell":
      console.log(`Contract sold:`);
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
});

connection.on("error", (error) => {
  console.error("WebSocket error:", error);
});

// Fix reconnection logic to use let for connection instead of const
connection.on("close", () => {
  console.log("Disconnected from WebSocket server");
  // Implement proper reconnection logic
  setTimeout(() => {
    console.log("Attempting to reconnect...");
    // Create a new connection rather than reassigning the const variable
    const newConnection = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
    );

    // Transfer all event handlers to the new connection
    // In a production environment, you would need to properly re-initialize with all handlers
    console.log("New connection established - please restart the application");
    process.exit(1); // Exit the application to allow for a clean restart
  }, 5000);
});

console.log("Starting Deriv trading bot...");
// The connection.on("open") handler will initialize everything once connected
