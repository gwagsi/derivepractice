import DerivAPIBasic from "https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic";
import { onNewTick } from "./chart.js"; // Assuming file1.js is the path

const app_id = 53485; // Replace with your app_id or leave as 1089 for testing.
const connection = new WebSocket(
  `wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
);
const api = new DerivAPIBasic({ connection });
console.log(api);
var count = 0;
const times = { times: 0 };
let hasOpenContract = {value:false};
let tmporalCount = {value:0};


// list of all dom elements

const proposal_request = {
  proposal: 1,
  // subscribe: 1,
  amount: 1,
  basis: "stake",
  contract_type: "ACCU",
  currency: "USD",
  growth_rate: 0.01,
  // duration: 1,
  //duration_unit: 'm',
  symbol: "R_100",
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
      count++;
      console.log(count);

      // Track contract status and price for informed decisions
      
   

      // Buy a contract on even count, tracking buy price

      if (count % 2 === 0 &&  hasOpenContract.value===false) {
        tmporalCount.value++;
        //console.log("increaind count")
        if (tmporalCount.value >=2) {
        //  console.log("increased count")
          tmporalCount.value = 0;
      //  console.log(" opencontracts",  hasOpenContract.value);
        let buyPrice = Math.pow(1.01, times.times).toFixed(2);
        const proposalData = await api.proposal(proposal_request);
        const proposalId = proposalData.proposal.id;
       // console.log("here is the propose ", proposalId);
      // console.log("here is the  after buy price %s", buyPrice);
        const buyObject = {
         buy: proposalId,
          price: buyPrice ,
        };
        //const buyData =await api.buy(buyObject);
        try {
          await api.buy(buyObject);
          times.times++;
          if (times.times >= 50) {
             times.times = 0;
            }
        } catch (e) {
          console.log(e);
        }
        console.log("Buying contract at count", count, "for price", buyPrice);
        hasOpenContract.value = true;
       // console.log("has open contract", hasOpenContract.value);
      }
      }

     // Sell (close) the contract on the next even count if open
      if (count % 2 === 0 && hasOpenContract.value===true) {
        tmporalCount.value++;
  
        if (tmporalCount.value >= 2) {
          tmporalCount.value = 0;
          console.log("Selling contract at count", count);
          // Logic to sell (close) the contract based on buyPrice and current market data
          hasOpenContract.value = false;
          const portfolioData = await api.portfolio({
            portfolio: 1,
          });
          const portContractId =
            portfolioData.portfolio.contracts[0].contract_id;
         // console.log("Purchased", portContractId);
          api.sell({
            sell: portContractId,
            price: 0,
          });
        }
      }
      // // console.log(data.tick);
      // onNewTick(data.tick);
      break;
    case "buy":
      //console.log(data.buy);

      break;

    default:
      //console.log("Unknown msg_type: %s", data.msg_type);
      break;
  }
};

const getProposal = async () => {
  console.log("Subscribed to proposal");
  connection.addEventListener("message", proposalResponse);

  await api.proposal(proposal_request);
  await api.balance(balance_request);
  // proposal.remove()
  await api.ticks({
    ticks: "R_100",
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
  await api.authorize(user_accounts[0].token);
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
    token: "a1-0ab2XxopF9xHw1wrz3ZlaPzsCRwAH",
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
