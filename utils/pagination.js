// utils/pagination.js

/**
 * Paginates a Mongoose query
 * @param {Query} query - Mongoose query object
 * @param {Object} options - Pagination options
 * @param {number} options.page - Current page number (default: 1)
 * @param {number} options.limit - Number of items per page (default: 10)
 * @param {boolean} options.lean - Whether to return lean documents (default: false)
 * @returns {Promise<Object>} Pagination result
 */
const paginate = async (query, options = {}) => {
  // Parse options with defaults
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 10;
  const lean = options.lean || false;
  const populate = options.populate || null;
  
  // Calculate skip value
  const skip = (page - 1) * limit;

  // Clone the query to avoid modifying the original
  const countQuery = query.model.find().merge(query);
  const docsQuery = query.skip(skip).limit(limit);

  // Apply lean if specified
  if (lean) {
    docsQuery.lean();
  }

  // Apply population if specified
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(p => docsQuery.populate(p));
    } else {
      docsQuery.populate(populate);
    }
  }

  // Execute queries in parallel
  const [total, docs] = await Promise.all([
    countQuery.countDocuments(),
    docsQuery.exec()
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    docs,
    total,
    limit,
    page,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
    pagingCounter: (page - 1) * limit + 1,
    meta: {
      totalItems: total,
      itemsPerPage: limit,
      currentPage: page,
      totalPages,
      hasNextPage,
      hasPrevPage
    }
  };
};

/**
 * Creates pagination middleware for Express routes
 * @param {Object} options - Default pagination options
 * @returns {Function} Express middleware
 */
const paginationMiddleware = (options = {}) => {
  return (req, res, next) => {
    req.paginate = async (query, customOptions = {}) => {
      const mergedOptions = {
        ...options,
        ...customOptions,
        ...req.query // Allow query params to override
      };
      
      return paginate(query, mergedOptions);
    };
    next();
  };
};

// Change the export to CommonJS syntax
module.exports = {
  paginate,
  paginationMiddleware
};