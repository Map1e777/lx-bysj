const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

// GET /api/notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { unread, type } = req.query
    const userId = req.user.id

    const conditions = ['user_id = ?']
    const params = [userId]

    if (unread === 'true') { conditions.push('is_read = 0') }
    if (type) { conditions.push('type = ?'); params.push(type) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const countRow = await db.get(`SELECT COUNT(*) as count FROM notifications ${where}`, params)
    const total = countRow.count

    const notifications = await db.all(`
      SELECT id, type, payload, is_read, created_at
      FROM notifications
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    const parsed = notifications.map(n => ({
      ...n,
      payload: (() => { try { return JSON.parse(n.payload) } catch { return {} } })()
    }))

    const unreadCountRow = await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [userId])
    const unreadCount = unreadCountRow.count

    return res.json({
      code: 200,
      message: 'success',
      data: {
        ...paginatedResponse(parsed, total, page, limit),
        unread_count: unreadCount
      }
    })
  } catch (err) {
    console.error('List notifications error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id])
    return res.json({ code: 200, message: '所有通知已标记为已读' })
  } catch (err) {
    console.error('Mark all read error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await db.get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])

    if (!notification) {
      return res.status(404).json({ code: 404, message: '通知不存在' })
    }

    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notification.id])
    return res.json({ code: 200, message: '已标记为已读' })
  } catch (err) {
    console.error('Mark read error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/notifications/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await db.get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])

    if (!notification) {
      return res.status(404).json({ code: 404, message: '通知不存在' })
    }

    await db.run('DELETE FROM notifications WHERE id = ?', [notification.id])
    return res.json({ code: 200, message: '通知已删除' })
  } catch (err) {
    console.error('Delete notification error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
