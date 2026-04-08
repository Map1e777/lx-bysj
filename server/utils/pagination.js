/**
 * Parse pagination parameters from query string
 * @param {object} query - req.query object
 * @param {number} defaultLimit - default items per page
 * @returns {{ page, limit, offset }}
 */
function parsePagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaultLimit))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

/**
 * Build a paginated response
 */
function paginatedResponse(items, total, page, limit) {
  return {
    list: items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}

module.exports = { parsePagination, paginatedResponse }
