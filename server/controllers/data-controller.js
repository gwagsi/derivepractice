const DataDisplayService = require("../services/data-display-services");
const { logger } = require("../utils/logger");
const {
  validatePaginationParams,
  validateSearchParams,
} = require("../utils/validation");

class DataController {
  // Get paginated data
  async getData(req, res) {
    try {
      const { symbol, risk } = req.params;
      const { page = 1, limit = 20, sortBy = "id", sortOrder = 1 } = req.query;

      // Validate parameters
      const validatedParams = validatePaginationParams({
        page,
        limit,
        sortBy,
        sortOrder,
      });

      const service = new DataDisplayService(symbol, risk);
      const result = await service.getData(
        validatedParams.page,
        validatedParams.limit,
        validatedParams.sortBy,
        validatedParams.sortOrder
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("Error in getData controller:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Search data
  async searchData(req, res) {
    try {
      const { symbol, risk } = req.params;
      const { q: searchTerm, fields, page = 1, limit = 20 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: "Search term is required",
        });
      }

      const validatedParams = validateSearchParams({
        searchTerm,
        fields,
        page,
        limit,
      });

      const service = new DataDisplayService(symbol, risk);
      const result = await service.searchData(
        validatedParams.searchTerm,
        validatedParams.fields,
        validatedParams.page,
        validatedParams.limit
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("Error in searchData controller:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get data statistics
  async getStats(req, res) {
    try {
      const { symbol, risk } = req.params;

      const service = new DataDisplayService(symbol, risk);
      const result = await service.getDataStats();

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("Error in getStats controller:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get available collections
  async getCollections(req, res) {
    try {
      const service = new DataDisplayService("dummy", "dummy"); // Just for method access
      const collections = await service.getAvailableCollections();

      res.json({
        success: true,
        collections,
      });
    } catch (error) {
      logger.error("Error in getCollections controller:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Filter data
  async filterData(req, res) {
    try {
      const { symbol, risk } = req.params;
      const { page = 1, limit = 20, sortBy = "id", sortOrder = 1 } = req.query;

      // Build filter from query parameters
      const filter = {};
      if (req.query.minCount)
        filter.count = { $gte: parseInt(req.query.minCount) };
      if (req.query.maxCount)
        filter.count = { ...filter.count, $lte: parseInt(req.query.maxCount) };
      if (req.query.minId) filter.id = { $gte: parseInt(req.query.minId) };
      if (req.query.maxId)
        filter.id = { ...filter.id, $lte: parseInt(req.query.maxId) };

      const validatedParams = validatePaginationParams({
        page,
        limit,
        sortBy,
        sortOrder,
      });

      const service = new DataDisplayService(symbol, risk);
      const result = await service.getDataByFilter(
        filter,
        validatedParams.page,
        validatedParams.limit,
        validatedParams.sortBy,
        validatedParams.sortOrder
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("Error in filterData controller:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new DataController();
