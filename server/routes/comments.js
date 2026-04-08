const express = require('express')
const router = express.Router({ mergeParams: true })
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireDocPermission } = require('../middleware/permissions')
const { createNotification } = require('../services/notificationService')
const { getIO } = require('../wsServer')

function buildCommentTree(comments) {
  const map = {}
  const roots = []
  comments.forEach(c => { map[c.id] = { ...c, replies: [] } })
  comments.forEach(c => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].replies.push(map[c.id])
    } else {
      roots.push(map[c.id])
    }
  })
  return roots
}

// GET /api/documents/:id/comments
router.get('/:id/comments', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const comments = await db.all(`
      SELECT c.id, c.parent_id, c.author_id, c.content, c.selection_ref,
             c.is_resolved, c.resolved_by, c.resolved_at, c.created_at, c.updated_at,
             u.username as author_username, u.avatar_url as author_avatar,
             ru.username as resolved_by_username
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN users ru ON c.resolved_by = ru.id
      WHERE c.document_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `, [req.params.id])

    return res.json({ code: 200, message: 'success', data: buildCommentTree(comments) })
  } catch (err) {
    console.error('Get comments error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/comments
router.post('/:id/comments', authenticateToken, requireDocPermission('comment'), async (req, res) => {
  try {
    const { content, selection_ref } = req.body
    const docId = req.params.id

    if (!content || !content.trim()) {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' })
    }

    const result = await db.run(
      'INSERT INTO comments (document_id, author_id, content, selection_ref) VALUES (?, ?, ?, ?)',
      [docId, req.user.id, content.trim(), selection_ref || null]
    )

    const comment = await db.get(`
      SELECT c.*, u.username as author_username, u.avatar_url as author_avatar
      FROM comments c LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `, [result.insertId])

    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId])
    if (doc && doc.owner_id !== req.user.id) {
      await createNotification(doc.owner_id, 'comment.new', {
        document_id: parseInt(docId),
        document_title: doc.title,
        comment_id: result.insertId,
        commenter: req.user.username
      })
    }

    const io = getIO()
    if (io) io.to(`doc:${docId}`).emit('comment:new', comment)

    return res.status(201).json({ code: 201, message: '评论已添加', data: comment })
  } catch (err) {
    console.error('Create comment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/documents/:id/comments/:cid
router.put('/:id/comments/:cid', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' })
    }

    const comment = await db.get('SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL', [req.params.cid])
    if (!comment) {
      return res.status(404).json({ code: 404, message: '评论不存在' })
    }

    if (comment.author_id !== req.user.id && req.user.system_role !== 'system_admin') {
      return res.status(403).json({ code: 403, message: '只能编辑自己的评论' })
    }

    await db.run('UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [content.trim(), comment.id])

    const updated = await db.get(`
      SELECT c.*, u.username as author_username, u.avatar_url as author_avatar
      FROM comments c LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `, [comment.id])

    const io = getIO()
    if (io) io.to(`doc:${req.params.id}`).emit('comment:updated', updated)

    return res.json({ code: 200, message: '评论已更新', data: updated })
  } catch (err) {
    console.error('Edit comment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/documents/:id/comments/:cid
router.delete('/:id/comments/:cid', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const comment = await db.get('SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL', [req.params.cid])
    if (!comment) {
      return res.status(404).json({ code: 404, message: '评论不存在' })
    }

    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id])
    const canDelete = comment.author_id === req.user.id ||
      (doc && doc.owner_id === req.user.id) ||
      req.user.system_role === 'system_admin'

    if (!canDelete) {
      return res.status(403).json({ code: 403, message: '无权删除此评论' })
    }

    await db.run('UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [comment.id])

    const io = getIO()
    if (io) io.to(`doc:${req.params.id}`).emit('comment:deleted', { id: comment.id })

    return res.json({ code: 200, message: '评论已删除' })
  } catch (err) {
    console.error('Delete comment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/comments/:cid/reply
router.post('/:id/comments/:cid/reply', authenticateToken, requireDocPermission('comment'), async (req, res) => {
  try {
    const { content } = req.body
    const docId = req.params.id
    const parentId = req.params.cid

    if (!content || !content.trim()) {
      return res.status(400).json({ code: 400, message: '回复内容不能为空' })
    }

    const parent = await db.get('SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL', [parentId])
    if (!parent) {
      return res.status(404).json({ code: 404, message: '父评论不存在' })
    }

    const result = await db.run(
      'INSERT INTO comments (document_id, parent_id, author_id, content) VALUES (?, ?, ?, ?)',
      [docId, parseInt(parentId), req.user.id, content.trim()]
    )

    const reply = await db.get(`
      SELECT c.*, u.username as author_username, u.avatar_url as author_avatar
      FROM comments c LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `, [result.insertId])

    if (parent.author_id !== req.user.id) {
      const doc = await db.get('SELECT title FROM documents WHERE id = ?', [docId])
      await createNotification(parent.author_id, 'comment.reply', {
        document_id: parseInt(docId),
        document_title: doc?.title || '',
        comment_id: result.insertId,
        parent_comment_id: parseInt(parentId),
        replier: req.user.username
      })
    }

    const io = getIO()
    if (io) io.to(`doc:${docId}`).emit('comment:new', reply)

    return res.status(201).json({ code: 201, message: '回复已添加', data: reply })
  } catch (err) {
    console.error('Reply comment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/documents/:id/comments/:cid/resolve
router.put('/:id/comments/:cid/resolve', authenticateToken, requireDocPermission('write'), async (req, res) => {
  try {
    const comment = await db.get('SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL', [req.params.cid])
    if (!comment) {
      return res.status(404).json({ code: 404, message: '评论不存在' })
    }

    const newResolved = comment.is_resolved ? 0 : 1
    const resolvedBy = newResolved ? req.user.id : null
    const resolvedAt = newResolved ? new Date().toISOString() : null

    await db.run(
      'UPDATE comments SET is_resolved = ?, resolved_by = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newResolved, resolvedBy, resolvedAt, comment.id]
    )

    const updated = await db.get(`
      SELECT c.*, u.username as author_username
      FROM comments c LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `, [comment.id])

    const io = getIO()
    if (io) io.to(`doc:${req.params.id}`).emit('comment:updated', updated)

    return res.json({ code: 200, message: newResolved ? '评论已标记为解决' : '评论已取消解决', data: updated })
  } catch (err) {
    console.error('Resolve comment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
