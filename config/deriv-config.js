// config/deriv-config.js
module.exports = {
  APP_ID: process.env.DERIV_APP_ID || 53485,
  WS_URL: process.env.DERIV_WS_URL || "wss://ws.derivws.com/websockets/v3",
  USER_ACCOUNTS: JSON.parse(process.env.USER_ACCOUNTS || "[]"),
};
