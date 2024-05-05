 
import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";

// import { onNewTick } from "./chart.js";
// import { saveTickDataToCsv } from "./save_tick_tofile.js";
const app_id = 53485; // Replace with your app_id or leave as 1089 for testing.
const connection = new WebSocket(
  `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
);

const api = new DerivAPIBasic({ connection });
//const api = new DerivAPIBasic({ connection });
 
var count = 0;
var previousQuote = null;
const times = { times: 0 };
let hasOpenContract = { value: false };
let tmporalCount = { value: 0 };
const contractId = { value: null };
const buyCount = { value: 20 };
const hasbuyCount = { value: 20 };
const vix10BuyCount = { value: 20 };
const vix10HasbuyCount = { value: 20 };
const vix25BuyCount = { value: 20 };
const vix25HasbuyCount = { value: 20 };
const vix50BuyCount = { value: 20 };
const vix50HasbuyCount = { value: 20 };
const vix75BuyCount = { value: 20 };
const vix75HasbuyCount = { value: 20 };
const vix100BuyCount = { value: 20 };
const vix100HasbuyCount = { value: 20 };
const vix10sBuyCount = { value: 20 };
const vix10sHasbuyCount = { value: 20 };
const vix100sBuyCount = { value: 20 };
const vix100sHasbuyCount = { value:  0 };
let vix25sBuyCount = { value: 20 };
let vix25sHasbuyCount = { value: 20 };
let vix50sBuyCount = { value: 20 };
let vix50sHasbuyCount = { value: 20 };
let vix75sBuyCount = { value: 20 };
let vix75sHasbuyCount = { value: 20 };

let random = { value: 20 };
let buyQuote = { value: null };
let mainBalance = { value: 0 };
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


const priceContainer = document.getElementById('price-container');

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
    take_profit: 9.02,
  },
  // duration: 1,
  //duration_unit: 'm',
};

const balance_request = {
  balance: 1,
  subscribe: 1,
};

const proposalResponse = async (res) => {
  const data = JSON.parse(res.data);

   

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

      if (data.balance.balance < mainBalance.value - 1.5) {
        times.times = 0;
      }

      break;
    case "tick":
      const tickquote = data.echo_req.ticks;
      const tick = data.tick.quote;
// console.log("tick",tick)
// console.log("tickquote",tickquote)  
      quotesFunction(
        "1HZ10V",
        vix10scurrentQuote,
        vix10spreviousQuote,
        tick,
        tickquote,
        0.00344,
        vix10sBuyCount,
        vix10sHasbuyCount
      );
      quotesFunction(
        "R_100",
        vix100currentQuote,
        vix100previousQuote,
        tick,
        tickquote,
        0.04863,
        vix100BuyCount,
        vix100HasbuyCount
      );
      quotesFunction(
        "1HZ100V",
        vix100scurrentQuote,
        vix100spreviousQuote,
        tick,
        tickquote,
        0.03438,
        vix100sBuyCount,
        vix100sHasbuyCount
      );
      quotesFunction(
        "R_10",
        vix10currentQuote,
        vix10previousQuote,
        tick,
        tickquote,
        0.00486,
        vix10BuyCount,
        vix10HasbuyCount
      );
      quotesFunction(
        "1HZ25V",
        vix25scurrentQuote,
        vix25spreviousQuote,
        tick,
        tickquote,
        0.00860,
        vix25sBuyCount,
        vix25sHasbuyCount
      );
      quotesFunction(
        "R_25",
        vix25currentQuote,
        vix25previousQuote,
        tick,
        tickquote,
        0.01216,
        vix25BuyCount,
        vix25HasbuyCount
      );
      quotesFunction(
        "1HZ50V",
        vix50scurrentQuote,
        vix50spreviousQuote,
        tick,
        tickquote,
        0.01719,
        vix50sBuyCount,
        vix50sHasbuyCount
      );
      quotesFunction(
        "R_50",
        vix50currentQuote,
        vix50previousQuote,
        tick,
        tickquote,
        0.02431,
        vix50BuyCount,
        vix50HasbuyCount
      );
      quotesFunction(
        "1HZ75V",
        vix75scurrentQuote,
        vix75spreviousQuote,
        tick,
        tickquote,
        0.02579,
        vix75sBuyCount,
        vix75sHasbuyCount
      );
      quotesFunction(
        "R_75",
        vix75currentQuote,
        vix75previousQuote,
        tick,
        tickquote,
        0.03647,
        vix75BuyCount,
        vix75HasbuyCount
      );

      // //   // Track contract status and price for informed decisions

      // //   console.log(data.tick);
      // onNewTick(data.tick);
      break;
    case "buy":
       console.log(data );

      break;

    case "sell":
      console.log("sell contract at  ");
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
 
  await api.ticks({
    ticks: "R_100",
     
  });

  // await api.ticks({
  //   ticks: "1HZ100V",
  //   subscribe: 1,
  // });

  // await api.ticks({
  //   ticks: "1HZ25V",
  //   subscribe: 1,
  // });
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
  // });

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
    token: "a1-EKrq52HI5qoN5GNdRAHWzSZPPIy6M",
    currency: "USD",
  },
];

// Buy a contract on even count, tracking buy price
const buyContract = async (symbolValue) => {
  // hasOpenContract.value = true;
  // console.log(" times", times.times);
  let buyPrice = parseFloat(Math.pow(1.03, times.times).toFixed(2));

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
    if (times.times >= 60) {
      times.times = 0;
    }
    //hasOpenContract.value = true;
    console.log("Bought contract at  ", buyPrice);
    console.log("contract ", symbolValue);
  } catch (e) {
    console.log(e);
    console.log("error buying contract");
    if (e?.error?.code === "RateLimit") {
      console.log("rate limit");
      hasOpenContract.value = false;
      tmporalCount.value = 0;
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
  point,
  buyCount,
  hasbuyCount
) => {
  if (tickquote === quote) {
    currentquote.quote = tick;

    if (previosequote.quote !== null) {
      console.log("quote", quote);
      // Skip the check for the first tick as there's no previous quote
      const percentage_change =
        ((currentquote.quote - previosequote.quote) / previosequote.quote) *
        100;
        previosequote.quote = currentquote.quote;

      const within_limit = Math.abs(percentage_change) <= point;

      if (within_limit) {
        buyCount.value += 1;
      
        // console.log("Within Limits");
        // console.log("hasbuyCount", hasbuyCount.value);
        //console.log("tick count countbuy",buyCount.value);
      } else {
        const priceElement = document.createElement('div');
        priceElement.classList.add('price');
        priceElement.textContent = buyCount.value;
        if ( buyCount.value === 1) {
          priceElement.classList.add('red');
        }
    
        if( buyCount.value>=20){
            priceElement.classList.add('green');
        }
        priceContainer.prepend(priceElement);
        //console.log("spike");
       // console.log("hasbuyCount", hasbuyCount.value);
        if (buyCount.value >= 20 && hasbuyCount.value <= 4) {
          
         // console.log("count for %s is %s", quote, buyCount.value);
          buyCount.value = 0;
          hasbuyCount.value += 1;

          buyContract(quote);
        } else {
          buyCount.value = 0;
        }
      }
    } else {
      previosequote.quote = currentquote.quote;
      buyCount.value = 0;
    }
    // Update the previous quote for the next tick
  }
};
