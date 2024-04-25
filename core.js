import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";

// import { onNewTick } from "./chart.js";
// import { saveTickDataToCsv } from "./save_tick_tofile.js";
const app_id = 53485; // Replace with your app_id or leave as 1089 for testing.
const connection = new WebSocket(
  `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
);
const api = new DerivAPIBasic({ connection });
console.log(api);
var count = 0;
var previousQuote = null;
const times = { times: 0 };
let hasOpenContract = { value: false };
let tmporalCount = { value: 0 };

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

// list of all dom elements

const proposal_request = {
  proposal: 1,
  // subscribe: 1,
  amount: 1,
  basis: "stake",
  contract_type: "ACCU",
  currency: "USD",
  growth_rate: 0.01,
  symbol: "R_100",
  // duration: 1,
  //duration_unit: 'm',
};

const balance_request = {
  balance: 1,
  subscribe: 1,
};

const proposalResponse = async (res) => {
  const data = JSON.parse(res.data);

  // console.log('Data: %o', data);

  switch (data.msg_type) {
    case undefined:
      console.log("Error: %s ", data.error.message);
      //connection.removeEventListener("message", proposalResponse, false);
      //await api.disconnect();
      break;
    // case "proposal":
    //   // console.log('Details: %s', data.proposal.longcode);
    //   // console.log('Ask Price: %s', data.proposal.display_value);
    //   // console.log('Payout: %f', data.proposal.payout);
    //   // console.log('Spot: %f', data.proposal.spot);
    //   console.log("propsosal ID: %s", data.proposal.id);
    //   globalVariable.proposalId = data.proposal.id;

    //   //console.log("here is the id stare %s",proposalIdSet)

    //   // Uncomment these lines if needed for authorization and purchase actions:
    //   // await api.authorize(user_accounts[4].token);

    //   break;
    case "balance":
      const balance_update = document.getElementById("balance_update");
      const balance_currency = document.getElementById("balance_currency");
      // console.log( 'Balance: %s', data.balance.balance,

      // )
      balance_update.innerHTML = data.balance.balance;
      balance_currency.innerHTML = data.balance.currency;
      break;
    case "tick":
      if (data.echo_req.ticks === "1HZ10V") {
        vix10scurrentQuote.quote = data.tick.quote;
        console.log("Vix10s current quote: %s", vix10scurrentQuote.quote);
        // saveTickDataToCsv(data.tick);

        if (vix10spreviousQuote.quote !== null) {
          // Skip the check for the first tick as there's no previous quote
          const difference =
            vix10scurrentQuote.quote - vix10spreviousQuote.quote;
          console.log("Difference: %s", difference);
          if (hasOpenContract.value === true) {
            sellContract();
          }

          if (hasOpenContract.value === false) {
            if (difference >= 0.423) {
              console.log("The quote has gone up by 0.897 or more");
              console.log("buying vix10s");
              buyContract("1HZ10V");
            } else if (difference <= -0.423) {
              console.log("The quote has gone down by 0.897 or more");
              console.log("buying vix10s");
              buyContract("1HZ10V");
            }
          }
        }

        // Update the previous quote for the next tick
        vix10spreviousQuote.quote = vix10scurrentQuote.quote;
      }

      if (data.echo_req.ticks === "R_100") {
        vix100currentQuote.quote = data.tick.quote;
        console.log("Vix100 current quote: %s", vix100currentQuote.quote);
        // saveTickDataToCsv(data.tick);
        if (vix100previousQuote.quote !== null) {
          // Skip the check for the first tick as there's no previous quote
          const difference =
            vix100currentQuote.quote - vix100previousQuote.quote;
          console.log("Difference: %s", difference);
          if (hasOpenContract.value === true) {
            sellContract();
          }

          if (hasOpenContract.value === false) {
            if (difference >= 0.998 || difference==0) {
              console.log("The quote has gone up by 0.897 or more");
              console.log("buying vix100");
              buyContract("R_100");
            } else if (difference <= -0.998) {
              console.log("The quote has gone down by 0.897 or more");
              console.log("buying vix100");
              buyContract("R_100");
            }
          }
        }

        // Update the previous quote for the next tick
        vix100previousQuote.quote = vix100currentQuote.quote;
      }

      if (data.echo_req.ticks === "1HZ100V") {
        vix100scurrentQuote.quote = data.tick.quote;
        console.log("Vix100s current quote: %s", vix100scurrentQuote.quote);
        // saveTickDataToCsv(data.tick);
        if (vix100spreviousQuote.quote !== null) {
          // Skip the check for the first tick as there's no previous quote
          const difference =
            vix100scurrentQuote.quote - vix100spreviousQuote.quote;
          console.log("Difference: %s", difference);
          if (hasOpenContract.value === true) {
            sellContract();
          }

          if (hasOpenContract.value === false) {
            if (difference >= 0.424 || difference==0) {
              console.log("The quote has gone up by 0.897 or more");
              console.log("buying vix100s");
              buyContract("1HZ100V");
            } else if (difference <= -0.424) {
              console.log("The quote has gone down by 0.897 or more");
              console.log("buying vix100s");
              buyContract("1HZ100V");
            }
          }
        }

        // Update the previous quote for the next tick
        vix100spreviousQuote.quote = vix100scurrentQuote.quote;
      }


      if (data.echo_req.ticks === "R_10") {
        vix10currentQuote.quote = data.tick.quote;
        console.log("Vix10  current quote: %s", vix10currentQuote.quote);
        // saveTickDataToCsv(data.tick);

        if (vix10previousQuote.quote !== null) {
          // Skip the check for the first tick as there's no previous quote
          const difference =
           ( vix10currentQuote.quote - vix10previousQuote.quote);
          console.log("Difference: %s", difference);
          if (hasOpenContract.value === true) {
            sellContract();
          }

          if (hasOpenContract.value === false) {
              console.log("The quote has gone up by 0.897 or more");
            if (difference >= 0.0825  || difference==0 ) {
              console.log("The quote has gone up by 0.897 or more");
              console.log("buying vix10 ");
              buyContract("R_10");
            } else if (difference <= -0.0825) {
              console.log("The quote has gone down by 0.897 or more");
              console.log("buying vix10 ");
              buyContract("R_10");
            }
          }
        }

        // Update the previous quote for the next tick
        vix10previousQuote.quote = vix10currentQuote.quote;
      }


      if (data.echo_req.ticks === "1HZ25V") {
        vix25scurrentQuote.quote = data.tick.quote;
        console.log("Vix25s current quote: %s", vix25scurrentQuote.quote);
        // saveTickDataToCsv(data.tick);
        if (vix100spreviousQuote.quote !== null) {
          // Skip the check for the first tick as there's no previous quote
          const difference =
            vix25scurrentQuote.quote - vix25spreviousQuote.quote;
          console.log("Difference: %s", difference);
          if (hasOpenContract.value === true) {
            sellContract();
          }

          if (hasOpenContract.value === false) {
            if (difference >= 0.024 || difference==0) {
              console.log("The quote has gone up by 0.897 or more");
              console.log("buying vix100s");
              buyContract("1HZ25V");
            } else if (difference <= -0.024) {
              console.log("The quote has gone down by 0.897 or more");
              console.log("buying vix100s");
              buyContract("1HZ25V");
            }
          }
        }

        // Update the previous quote for the next tick
        vix25spreviousQuote.quote = vix25scurrentQuote.quote;
      }
      quotesFunction("1HZ10V",vix10scurrentQuote,vix10spreviousQuote);
      quotesFunction("R_100",vix100currentQuote,vix100previousQuote);
      quotesFunction("1HZ100V",vix100scurrentQuote,vix100spreviousQuote);
      quotesFunction("R_10",vix10currentQuote,vix10previousQuote);
      quotesFunction("1HZ25V",vix25scurrentQuote,vix25spreviousQuote);

      // //   // Track contract status and price for informed decisions

      // //   console.log(data.tick);
      // onNewTick(data.tick);
      break;
    case "buy":
      //console.log(data.buy);

      break;

    case "sell":
      if (data?.error?.code) {
        hasOpenContract.value = true;
        tmporalCount.value = 0;
        sellContract();
      }

      break;

    default:
      //console.log("Unknown msg_type: %s", data.msg_type);
      break;
  }
};

const getProposal = async () => {
  console.log("Subscribed to proposal");
  connection.addEventListener("message", proposalResponse);

  // await api.proposal(proposal_request);
  await api.balance(balance_request);
  // proposal.remove()
  await api.ticks({
    ticks: "R_100",
    subscribe: 1,
  });
  await api.ticks({
    ticks: "1HZ10V",
    subscribe: 1,
  });

  await api.ticks({
    ticks: "1HZ100V",
    subscribe: 1,
  });
  //console.log(balance)
  //await api.subscribe({ ticks: 'R_100' });
};

const unsubscribeProposal = () => {
  alert("Unsubscribed from proposal");
  connection.removeEventListener("message", proposalResponse, false);
};

const authorizeApp = async () => {
  console.log("here to authorise");
  await api.authorize(user_accounts[4].token);
  console.log("authorised app");
};

const proposal = document.querySelector("#proposal");
proposal.addEventListener("click", getProposal);

const proposal_unsubscribe = document.querySelector("#proposal-unsubscribe");
proposal_unsubscribe.addEventListener("click", unsubscribeProposal);

const authorize_app = document.querySelector("#authorize");
authorize_app.addEventListener("click", authorizeApp);

const user_accounts = [
  {
    account: "CR2120738",
    token: "a1-sZJg3FkK3gF9yxYBDYFSeD1HaRZnH",
    currency: "USD",
  },
  {
    account: "CR2140975",
    token: "a1-vDiAR8QtnPuuOQGvLAAMMzqGwbeO1",
    currency: "btc",
  },
  {
    account: "CR2213370",
    token: "a1-haaF76oak4oofuTTgLNsUSmkRps5A",
    currency: "eth",
  },
  {
    account: "CR3216385",
    token: "a1-6eGizjAu98ltNsMfk6G8LGbr9nL1J",
    currency: "eusdt",
  },
  {
    account: "VRTC3545234",
    token: "a1-nagfGAF8F1SdlhdFuIZQNmhtwvn25",
    currency: "USD",
  },
];

// Buy a contract on even count, tracking buy price
const buyContract = async (symbolValue) => {
  if (hasOpenContract.value === false) {
    let buyPrice = parseFloat(Math.pow(1.01, times.times).toFixed(2));

    const newPropsal = {
      ...proposal_request,
      amount: buyPrice,
      symbol: symbolValue,
    };
    console.log("here is the new proposal", newPropsal);
    const proposalData = await api.proposal(newPropsal);
    const proposalId = proposalData.proposal.id;
    // console.log("here is the propose ", proposalId);
    // console.log("here is the  after buy price %s", buyPrice);
    const buyObject = {
      buy: proposalId,
      price: 100,
    };
    //const buyData =await api.buy(buyObject);
    try {
      await api.buy(buyObject);
      times.times++;
      if (times.times >= 50) {
        times.times = 0;
      }
      hasOpenContract.value = true;
      tmporalCount.value = 0;
    } catch (e) {
      console.log(e);
    }
    console.log("Buying contract at count", count, "for price", buyPrice);

    // console.log("has open contract", hasOpenContract.value);
  }
};

const sellContract = async () => {
  console.log("here is the temporal count", tmporalCount.value);
  // Sell (close) the contract on the next even count if open
  tmporalCount.value++;

  if (tmporalCount.value >= 2) {
    console.log("here is the temporal count", tmporalCount.value);
    console.log("Selling contract at count", count);
    // Logic to sell (close) the contract based on buyPrice and current market data
    // hasOpenContract.value = false;
    // tmporalCount.value = 0;
    const portfolioData = await api.portfolio({
      portfolio: 1,
    });
    console.log("Portfolio", portfolioData);
    try {
      const portContractId = portfolioData.portfolio.contracts[0].contract_id;
      // console.log("Purchased", portContractId);

      const saleContrac = await api.sell({
        sell: portContractId,
        price: 0,
      });
      console.log("here is the sale contract", saleContrac);
      hasOpenContract.value = false;
      tmporalCount.value = 0;
    } catch (e) {
      console.log("could not sell contract , error %s", e);
      hasOpenContract.value = false;
      tmporalCount.value = 0;
    }
  }
};

const quotesFunction = async (quote,currentquote,previosequote) => {
  if (data.echo_req.ticks === quote) {
    currentquote.quote = data.tick.quote;
    
    // saveTickDataToCsv(data.tick);
    if (previosequote.quote !== null) {
      // Skip the check for the first tick as there's no previous quote
      const difference =
      currentquote.quote - previosequote.quote;
      console.log("Difference: %s", difference);
      if (hasOpenContract.value === true) {
        sellContract();
      }

      if (hasOpenContract.value === false) {
        if (difference >= 0.024 || difference==0) {
          console.log("The quote has gone up by 0.897 or more");
          console.log("buying vix100s");
          buyContract("1HZ25V");
        } else if (difference <= -0.024) {
          console.log("The quote has gone down by 0.897 or more");
          console.log("buying vix100s");
          buyContract("1HZ25V");
        }
      }
    }

    // Update the previous quote for the next tick
    previosequote.quote = currentquote.quote;
  }
}