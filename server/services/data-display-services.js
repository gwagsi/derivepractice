// services/DataDisplayService.js
const { logger } = require("../utils/logger");
const { getCollection } = require("../utils/db");
const { sleep } = require("../utils/helpers");
const constants = require("../config/constants");

class DataDisplayService {
  constructor(symbol, risk) {
    this.symbol = symbol;
    this.risk = risk;
    this.collectionName = this.risk + "_ticks_" + this.symbol;
  }

  async getData(page = 1, limit = 20, sortBy = "id", sortOrder = 1) {
    try {
      const collection = await getCollection(this.collectionName);
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const totalCount = await collection.countDocuments();

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder;

      // Fetch paginated data
      const data = await collection
        .find({})
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limit);
      const hasMore = page < totalPages;

      logger.info(
        `Fetched ${data.length} items from ${this.collectionName}, page ${page}/${totalPages}`
      );

      return {
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
        },
        metadata: {
          symbol: this.symbol,
          risk: this.risk,
          collection: this.collectionName,
        },
      };
    } catch (error) {
      logger.error(`Error fetching data from ${this.collectionName}:`, error);
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }

  async getDataByFilter(
    filter = {},
    page = 1,
    limit = 20,
    sortBy = "id",
    sortOrder = 1
  ) {
    try {
      const collection = await getCollection(this.collectionName);
      const skip = (page - 1) * limit;

      // Get total count for filtered results
      const totalCount = await collection.countDocuments(filter);

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder;

      // Fetch filtered and paginated data
      const data = await collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      const totalPages = Math.ceil(totalCount / limit);
      const hasMore = page < totalPages;

      logger.info(
        `Filtered fetch: ${data.length} items from ${this.collectionName}, page ${page}/${totalPages}`
      );

      return {
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
        },
        filter,
        metadata: {
          symbol: this.symbol,
          risk: this.risk,
          collection: this.collectionName,
        },
      };
    } catch (error) {
      logger.error(
        `Error fetching filtered data from ${this.collectionName}:`,
        error
      );
      throw new Error(`Failed to fetch filtered data: ${error.message}`);
    }
  }

  async searchData(
    searchTerm,
    searchFields = ["id", "count"],
    page = 1,
    limit = 20
  ) {
    try {
      const collection = await getCollection(this.collectionName);
      const skip = (page - 1) * limit;

      // Build search filter
      const searchFilter = {
        $or: searchFields.map((field) => {
          if (field === "id" || field === "count") {
            // For numeric fields, try to convert searchTerm to number
            const numericValue = parseInt(searchTerm);
            if (!isNaN(numericValue)) {
              return { [field]: numericValue };
            }
          }
          // For string fields or if numeric conversion fails
          return { [field]: { $regex: searchTerm, $options: "i" } };
        }),
      };

      const totalCount = await collection.countDocuments(searchFilter);

      const data = await collection
        .find(searchFilter)
        .sort({ id: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const totalPages = Math.ceil(totalCount / limit);
      const hasMore = page < totalPages;

      logger.info(
        `Search results: ${data.length} items from ${this.collectionName} for term "${searchTerm}"`
      );

      return {
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
        },
        searchTerm,
        searchFields,
        metadata: {
          symbol: this.symbol,
          risk: this.risk,
          collection: this.collectionName,
        },
      };
    } catch (error) {
      logger.error(`Error searching data in ${this.collectionName}:`, error);
      throw new Error(`Failed to search data: ${error.message}`);
    }
  }

  async getDataStats() {
    try {
      const collection = await getCollection(this.collectionName);

      // Aggregate statistics
      const stats = await collection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRecords: { $sum: 1 },
              avgCount: { $avg: "$count" },
              minCount: { $min: "$count" },
              maxCount: { $max: "$count" },
              minId: { $min: "$id" },
              maxId: { $max: "$id" },
            },
          },
        ])
        .toArray();

      // Count distribution
      const countDistribution = await collection
        .aggregate([
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$count", 0] }, then: "zero" },
                    { case: { $lte: ["$count", 10] }, then: "1-10" },
                    { case: { $lte: ["$count", 30] }, then: "11-30" },
                    { case: { $lte: ["$count", 50] }, then: "31-50" },
                    { case: { $lte: ["$count", 70] }, then: "51-70" },
                  ],
                  default: "70+",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      logger.info(`Generated stats for ${this.collectionName}`);

      return {
        summary: stats[0] || {},
        countDistribution,
        metadata: {
          symbol: this.symbol,
          risk: this.risk,
          collection: this.collectionName,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error(`Error generating stats for ${this.collectionName}:`, error);
      throw new Error(`Failed to generate stats: ${error.message}`);
    }
  }

  async getAvailableCollections() {
    try {
      const { getDB } = require("../utils/db");
      const db = await getDB();

      // Get all collections that match the pattern
      const collections = await db.listCollections().toArray();
      const tickCollections = collections
        .filter((col) => col.name.includes("_ticks_"))
        .map((col) => {
          const parts = col.name.split("_ticks_");
          return {
            name: col.name,
            risk: parts[0],
            symbol: parts[1],
            fullName: col.name,
          };
        });

      logger.info(`Found ${tickCollections.length} tick collections`);
      return tickCollections;
    } catch (error) {
      logger.error("Error getting available collections:", error);
      throw new Error(`Failed to get collections: ${error.message}`);
    }
  }
}

module.exports = DataDisplayService;
