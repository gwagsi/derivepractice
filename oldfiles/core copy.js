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
const contractId = { value: null };
const buyCount = { value: 20 };
const hasbuyCount = { value: 20 };

let random = { value: 20 };
let buyQuote = { value: null };
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

// list of all dom elements

const proposal_request = {
  proposal: 1,
  // subscribe: 1,
  amount: 1,
  basis: "stake",
  contract_type: "ACCU",
  currency: "USD",
  growth_rate: 0.05,
  symbol: "R_100",
  limit_order: {
    
    "take_profit": 0.05  
}
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
      const tickquote = data.echo_req.ticks;
      const tick = data.tick.quote;

      // quotesFunction(
      //   "1HZ10V",
      //   vix10scurrentQuote,
      //   vix10spreviousQuote,
      //   tick,
      //   tickquote,
      //   0.00361
      // );
      // quotesFunction(
      //   "R_100",
      //   vix100currentQuote,
      //   vix100previousQuote,
      //   tick,
      //   tickquote,
      //   0.05109
      // );
      // quotesFunction(
      //   "1HZ100V",
      //   vix100scurrentQuote,
      //   vix100spreviousQuote,
      //   tick,
      //   tickquote,
      //   0.03612
      // );
      // quotesFunction(
      //   "R_10",
      //   vix10currentQuote,
      //   vix10previousQuote,
      //   tick,
      //   tickquote,
      //   0.00511
      // );
      quotesFunction(
        "1HZ25V",
        vix25scurrentQuote,
        vix25spreviousQuote,
        tick,
        tickquote,
       0.00860
      );
      // quotesFunction(
      //   "R_25",
      //   vix25currentQuote,
      //   vix25previousQuote,
      //   tick,
      //   tickquote,
      //   0.01277
      // );
      // quotesFunction(
      //   "1HZ50V",
      //   vix50scurrentQuote,
      //   vix50spreviousQuote,
      //   tick,
      //   tickquote,
      //   0.01806
      // );
      // quotesFunction(
      //   "R_50",
      //   vix50currentQuote,
      //   vix50previousQuote,
      //   tick,
      //   tickquote,
      //   0.02554
      // );
      // quotesFunction(
      //   "1HZ75V",
      //   vix75scurrentQuote,
      //   vix75spreviousQuote,
      //   tick,
      //   tickquote,
      //   0.02709
      // );
      // quotesFunction(
      //   "R_75",
      //   vix75currentQuote,
      //   vix75previousQuote,
      //   tick,
      //   tickquote,
      //   0.03831
      // );

      // //   // Track contract status and price for informed decisions

      // //   console.log(data.tick);
      // onNewTick(data.tick);
      break;
    case "buy":
      //console.log(data.buy);

      break;

    case "sell":
      console.log(  "sell contract at  " );
      // if (data?.error?.code) {
      //   await api.sell({
      //     sell: contractId.value,
      //     price: 0,
      //   });
      // }

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

  // await api.ticks({
  //   ticks: "R_100",
  //   subscribe: 1,
  // });

  // await api.ticks({
  //   ticks: "1HZ100V",
  //   subscribe: 1,
  // });

  await api.ticks({
    ticks: "1HZ25V",
    subscribe: 1,
  });
  // await api.ticks({
  //   ticks: "R_25",
  //   subscribe: 1,
  // });

  // await api.ticks({
  //   ticks: "1HZ10V",
  //   subscribe: 1,
  // });
  // await api.ticks({
  //   ticks: "R_10",
  //   subscribe: 1,
  // });

  // await api.ticks({
  //   ticks: "R_50",
  //   subscribe: 1,
  // });
  // await api.ticks({
  //   ticks: "1HZ50V",
  //   subscribe: 1,
  // });
  // await api.ticks({
  //   ticks: "R_75",
  //   subscribe: 1,
  // });
  // await api.ticks({
  //   ticks: "1HZ75V",
  //   subscribe: 1,
  //});

  // const markup = await api.app_markup({
  //   app_markup_statistics: 1,
  //   date_from: "2022-01-01 00:00:00",
  //   date_to: "2024-04-31 23:59:59",
  //   passthrough: {},
  //   req_id: 4,
  // });
  // console.log(markup);
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
    hasOpenContract.value = true;
    console.log(" times", times.times);
    let buyPrice = parseFloat(Math.pow(1.05, times.times).toFixed(2));

    const newPropsal = {
      ...proposal_request,
      amount: buyPrice,
      symbol: symbolValue,
    };

    //const buyData =await api.buy(buyObject);
    try {
      const proposalData = await api.proposal(newPropsal);
      const proposalId = proposalData.proposal.id;
     // console.log(" buy price %s", buyPrice);
      const buyObject = {
        buy: proposalId,
        price: 100,
      };
      const buyNow = await api.buy(buyObject);
      contractId.value = buyNow.buy.contract_id;
      openContractQuote.quote = symbolValue;

      times.times++;
      if (times.times >= 100) {
        times.times = 0;
      }
      hasOpenContract.value = true;
      console.log("Buying contract at  ", buyPrice);
    } catch (e) {
      console.log(e);
      if (e?.error?.code === "RateLimit") {
        hasOpenContract.value = false;
        tmporalCount.value = 0;
      }
    }
  }
};

// const sellContract = async () => {
//   tmporalCount.value = tmporalCount.value + 1;
//   console.log("here is the temp count %s", tmporalCount.value);
//   if (tmporalCount.value >= 2) {
//     try {
//       const selling = await api.sell({
//         sell: contractId.value,
//         price: 0,
//       });
//       console.log("selling contract at  ", selling);
//       hasOpenContract.value = false;
//       tmporalCount.value = 0;
//     } catch (e) {
//       if (e?.error?.code === "InvalidSellPrice") {
//         console.log("invalid sell  ");
//         tmporalCount.value = 1;
//       }

//        if (e?.error?.code === "RateLimit") {
//         console.log("rate limit");
//         hasOpenContract.value = false;
//         tmporalCount.value = 0;}
//         if (e?.error?.code === "BetExpired") {
//           console.log("bet expired");
//           hasOpenContract.value = false;
//           tmporalCount.value = 0;
//           times.times = 0;
//         }

//         if (e?.error?.code === "InvalidSellContractProposal") {
//           console.log("InvalidSellContractProposal");
//           hasOpenContract.value = false;
//           tmporalCount.value = 0;
//           times.times = 0;
//         }
//       console.log(e);
//     }
//   }
// };

const quotesFunction = async (
  quote,
  currentquote,
  previosequote,
  tick,
  tickquote,
  point
) => {
  if (tickquote === quote) {
    // if (
    //   openContractQuote.quote == tickquote &&
    //   hasOpenContract.value === true
    // ) {
    //   console.log(
    //     "here is the open contract quote %s",
    //     openContractQuote.quote
    //   );
    // //  sellContract();
    }

    currentquote.quote = tick;

    if (previosequote.quote !== null  ) {
      // Skip the check for the first tick as there's no previous quote
      const percentage_change =
        ((currentquote.quote - previosequote.quote) / previosequote.quote) *
        100;
      //console.log("here is the difference %s", percentage_change);

      const within_limit = Math.abs(percentage_change) <= point;

      // if (percentage_change == 0) {
      //   console.log("the diffrence is 0");

      //   buyContract(quote);
      // }
      if (within_limit) {
        // buyContract(quote);
        // buyCount.value += 1;
        console.log("Within Limits")
        //console.log(buyCount.value);
      } else {
console.log("not within limit");
hasOpenContract.value=false
buyContract(quote);
        // if (buyCount.value <=1) {

        //   console.log(
        //     "first buy.",
        //     point
        //   );
        //   if (hasOpenContract.value == false) {
        //     // console.log("buying   %s", quote);
        //     buyContract(quote);
        //     hasbuyCount.value = 0;
        //   }
        // } else if (hasbuyCount.value <= 3) {
        //   console.log(
        //     "main buys",
        //     point
        //   );
        //   if (hasOpenContract.value == false) {
        //     // console.log("buying   %s", quote);
        //     buyContract(quote);
        //     hasbuyCount.value +=  1;
        //   }
          
        // } else {
        //   buyCount.value = 0;
        // }


        // // console.log(
        // //   "The current price is not within ±%s% from the previous price.",
        // //   point
        // // );
        // // if (hasOpenContract.value == false) {
        // //  // console.log("buying   %s", quote);
        // //   buyContract(quote);
        // // }
      }
    }
    // Update the previous quote for the next tick
    previosequote.quote = currentquote.quote;
  
};
 
