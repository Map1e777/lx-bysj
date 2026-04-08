const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

// GET /api/search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { q, status, visibility, scope } = req.query
    const { page, limit, offset } = parsePagination(req.query)
    const userId = req.user.id

    if (!q || !q.trim()) {
      return res.status(400).json({ code: 400, message: '请输入搜索关键词' })
    }

    const searchTerm = `%${q.trim()}%`

    const accessConditions = ['d.deleted_at IS NULL']
    const accessParams = []

    if (req.user.system_role !== 'system_admin') {
      if (scope === 'mine') {
        accessConditions.push('d.owner_id = ?')
        accessParams.push(userId)
      } else if (scope === 'org') {
        accessConditions.push("d.org_id = ? AND d.visibility IN ('org', 'public')")
        accessParams.push(req.user.org_id || -1)
      } else {
        accessConditions.push("(d.owner_id = ? OR dp.user_id = ? OR d.visibility = 'public' OR (d.visibility = 'org' AND d.org_id = ?))")
        accessParams.push(userId, userId, req.user.org_id || -1)
      }
    }

    if (status) { accessConditions.push('d.status = ?'); accessParams.push(status) }
    if (visibility) { accessConditions.push('d.visibility = ?'); accessParams.push(visibility) }

    accessConditions.push('(d.title LIKE ? OR d.content LIKE ? OR d.tags LIKE ?)')
    accessParams.push(searchTerm, searchTerm, searchTerm)

    const where = `WHERE ${accessConditions.join(' AND ')}`

    const countRow = await db.get(`
      SELECT COUNT(DISTINCT d.id) as count
      FROM documents d
      LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
      ${where}
    `, [userId, ...accessParams])
    const total = countRow.count

    const docs = await db.all(`
      SELECT DISTINCT
        d.id, d.title, d.status, d.visibility, d.owner_id, d.org_id,
        d.tags, d.word_count, d.current_version, d.created_at, d.updated_at,
        u.username as owner_username,
        COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'creator' ELSE NULL END) as my_role,
        CASE
          WHEN d.title LIKE ? THEN 3
          WHEN d.tags LIKE ? THEN 2
          ELSE 1
        END as relevance_score
      FROM documents d
      LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
      LEFT JOIN users u ON d.owner_id = u.id
      ${where}
      ORDER BY relevance_score DESC, d.updated_at DESC
      LIMIT ? OFFSET ?
    `, [userId, searchTerm, searchTerm, userId, ...accessParams, limit, offset])

    const results = docs.map(doc => ({
      ...doc,
      tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })(),
      relevance_score: undefined
    }))

    return res.json({
      code: 200,
      message: 'success',
      data: {
        ...paginatedResponse(results, total, page, limit),
        query: q.trim()
      }
    })
  } catch (err) {
    console.error('Search error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
