module.exports = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  formatCurrency: (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  },
};
