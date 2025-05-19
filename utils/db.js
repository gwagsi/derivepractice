const { MongoClient, ServerApiVersion } = require("mongodb");
const { logger } = require("./logger");

const DB_NAME = process.env.DB_NAME;
const MONGO_URI = process.env.MONGO_URI;

let client = null;
let db = null;

async function connect() {
  console.log("Connecting to MongoDB with URI:", MONGO_URI);
  try {
    client = new MongoClient(MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    db = client.db(DB_NAME);
    logger.info(`Connected to MongoDB database: ${DB_NAME}`);
    return db;
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
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

module.exports = { connect, getCollection, close };
