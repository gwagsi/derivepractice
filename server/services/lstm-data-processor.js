const { getCollection } = require("../utils/db");
const logger = require("../utils/logger");

class LSTMDataProcessor {
  constructor(symbol, risk) {
    this.symbol = symbol;
    this.risk = risk;
    this.collectionName = `${risk}_ticks_${symbol}`;
  }

  // Fetch full sequence of "count" values
  async fetchCountSequence() {
    try {
      const collection = await getCollection(this.collectionName);
      const data = await collection.find({}).sort({ id: 1 }).toArray(); // Chronological order
      return data.map((item) => item.count); // [6, 3, 4, 44, ...]
    } catch (error) {
      logger.error(
        `Error fetching sequence for ${this.collectionName}:`,
        error
      );
      throw error;
    }
  }

  // Convert sequence to supervised learning format
  prepareSupervisedData(sequence, windowSize = 10) {
    const X = [];
    const y = [];
    for (let i = 0; i < sequence.length - windowSize; i++) {
      const window = sequence.slice(i, i + windowSize);
      const label = sequence[i + windowSize] !== 1 ? 1 : 0;
      X.push(window);
      y.push(label);
    }
    return { X, y };
  }
}

module.exports = LSTMDataProcessor;
