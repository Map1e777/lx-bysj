const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireRole } = require('../middleware/roles')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

// GET /api/users/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(`
      SELECT u.id, u.username, u.email, u.system_role, u.org_id, u.org_role, u.avatar_url,
             u.dept_id, u.is_active, u.last_login_at, u.created_at, u.updated_at,
             o.name as org_name, d.name as dept_name
      FROM users u
      LEFT JOIN orgs o ON u.org_id = o.id
      LEFT JOIN departments d ON u.dept_id = d.id
      WHERE u.id = ?
    `, [req.user.id])

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    return res.json({ code: 200, message: 'success', data: user })
  } catch (err) {
    console.error('Get current user error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/users/me
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { username, avatar_url } = req.body

    if (username) {
      if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ code: 400, message: '用户名长度应在2-50字符之间' })
      }
      const existing = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id])
      if (existing) {
        return res.status(409).json({ code: 409, message: '用户名已被占用' })
      }
    }

    const updates = []
    const values = []

    if (username !== undefined) { updates.push('username = ?'); values.push(username) }
    if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url) }

    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(req.user.id)

    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)

    const updatedUser = await db.get(
      'SELECT id, username, email, system_role, org_id, org_role, avatar_url, dept_id, is_active, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    )

    return res.json({ code: 200, message: '更新成功', data: updatedUser })
  } catch (err) {
    console.error('Update user error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/users (admin only)
router.get('/', authenticateToken, requireRole('system_admin'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { search, system_role, is_active, org_id } = req.query

    const conditions = []
    const params = []

    if (search) {
      conditions.push('(u.username LIKE ? OR u.email LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (system_role) { conditions.push('u.system_role = ?'); params.push(system_role) }
    if (is_active !== undefined && is_active !== '') {
      conditions.push('u.is_active = ?')
      params.push(parseInt(is_active))
    }
    if (org_id) { conditions.push('u.org_id = ?'); params.push(parseInt(org_id)) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countRow = await db.get(`SELECT COUNT(*) as count FROM users u ${where}`, params)
    const total = countRow.count

    const users = await db.all(`
      SELECT u.id, u.username, u.email, u.system_role, u.org_id, u.org_role, u.avatar_url,
             u.is_active, u.last_login_at, u.created_at, o.name as org_name
      FROM users u
      LEFT JOIN orgs o ON u.org_id = o.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(users, total, page, limit) })
  } catch (err) {
    console.error('List users error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/users/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(`
      SELECT u.id, u.username, u.email, u.avatar_url, u.org_id, u.org_role, u.created_at,
             o.name as org_name
      FROM users u
      LEFT JOIN orgs o ON u.org_id = o.id
      WHERE u.id = ? AND u.is_active = 1
    `, [req.params.id])

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    return res.json({ code: 200, message: 'success', data: user })
  } catch (err) {
    console.error('Get user error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
