const constants = require("../config/constants");

const validatePaginationParams = (params) => {
  const { page, limit, sortBy, sortOrder } = params;

  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(
    Math.max(1, parseInt(limit) || 20),
    constants.MAX_LIMIT || 100
  );
  const validatedSortBy = ["id", "count", "_id"].includes(sortBy)
    ? sortBy
    : "id";
  const validatedSortOrder = [1, -1].includes(parseInt(sortOrder))
    ? parseInt(sortOrder)
    : 1;

  return {
    page: validatedPage,
    limit: validatedLimit,
    sortBy: validatedSortBy,
    sortOrder: validatedSortOrder,
  };
};

const validateSearchParams = (params) => {
  const { searchTerm, fields, page, limit } = params;

  const validatedSearchTerm = searchTerm?.trim() || "";
  const validatedFields = Array.isArray(fields)
    ? fields
    : fields
    ? fields.split(",")
    : ["id", "count"];
  const paginationParams = validatePaginationParams({ page, limit });

  return {
    searchTerm: validatedSearchTerm,
    fields: validatedFields,
    ...paginationParams,
  };
};

module.exports = {
  validatePaginationParams,
  validateSearchParams,
};
