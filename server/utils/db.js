const { MongoClient, ServerApiVersion } = require("mongodb");
const { logger } = require("./logger");

const DB_NAME = process.env.DB_NAME;
const MONGO_URI = process.env.MONGO_URI;

let client = null;
let db = null;

// Connection pool configuration
const MONGODB_OPTIONS = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
  maxPoolSize: 50, // Increased from 15 to handle concurrent operations
  minPoolSize: 5, // Keep some connections warm
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  ignoreUndefined: true,
  writeConcern: {
    w: 1, // Wait for acknowledgment from primary only
    j: false, // Don't wait for journal commit
  },
};

async function connect() {
  console.log("Connecting to MongoDB with URI:", MONGO_URI);
  try {
    client = new MongoClient(MONGO_URI, MONGODB_OPTIONS);

    await client.connect();
    db = client.db(DB_NAME);

    // Create indexes for commonly used collections to improve query performance
    // This is a one-time operation and will be skipped if indexes already exist
    // await createIndexes();

    logger.info(`Connected to MongoDB database: ${DB_NAME}`);
    return db;
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

async function createIndexes() {
  try {
    // Create indexes for common query patterns
    // This will help with sorting operations
    const symbolCollections = ["R_10", "R_25", "R_50", "R_75", "R_100"];

    for (const symbol of symbolCollections) {
      // Create an index on the epoch field for the main collections
      await db
        .collection(symbol)
        .createIndex({ epoch: 1 }, { background: true });

      // Create indexes for the tick collections
      for (let risk = 1; risk <= 5; risk++) {
        const tickCollection = `${risk}_ticks_${symbol}`;
        await db
          .collection(tickCollection)
          .createIndex({ id: 1 }, { background: true });
      }
    }

    logger.info("MongoDB indexes created or verified");
  } catch (error) {
    logger.warn(`Error creating indexes: ${error.message}`);
    // Continue even if index creation fails
  }
}

function getCollection(collectionName) {
  if (!db) throw new Error("Database not initialized");
  return db.collection(collectionName);
}

async function close() {
  if (client) {
    await client.close();
    logger.info("MongoDB connection closed");
  }
}

// Helper function for bulk operations
async function performBulkWrite(collectionName, operations, options = {}) {
  try {
    const collection = getCollection(collectionName);
    return await collection.bulkWrite(operations, {
      ordered: false, // Allows MongoDB to continue processing even if one operation fails
      ...options,
    });
  } catch (error) {
    logger.error(`Bulk write error for ${collectionName}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  connect,
  getCollection,
  close,
  performBulkWrite, // Export the bulk write helper
};
