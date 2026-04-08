const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireDocPermission } = require('../middleware/permissions')
const { auditLog } = require('../middleware/auditLog')
const { saveVersion } = require('../services/versionService')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

// GET /api/documents
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, visibility, search, scope } = req.query
    const userId = req.user.id

    const conditions = ['d.deleted_at IS NULL']
    const params = []

    if (scope === 'mine') {
      conditions.push('d.owner_id = ?')
      params.push(userId)
    } else if (scope === 'shared') {
      conditions.push('(dp.user_id = ? AND d.owner_id != ?)')
      params.push(userId, userId)
    } else if (scope === 'org') {
      conditions.push("d.org_id = ? AND d.visibility IN ('org', 'public')")
      params.push(req.user.org_id)
    } else {
      if (req.user.system_role !== 'system_admin') {
        conditions.push("(d.owner_id = ? OR dp.user_id = ? OR (d.visibility = 'public') OR (d.visibility = 'org' AND d.org_id = ?))")
        params.push(userId, userId, req.user.org_id || -1)
      }
    }

    if (status) { conditions.push('d.status = ?'); params.push(status) }
    if (visibility) { conditions.push('d.visibility = ?'); params.push(visibility) }
    if (search) {
      conditions.push('(d.title LIKE ? OR d.content LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const countRow = await db.get(`
      SELECT COUNT(DISTINCT d.id) as count
      FROM documents d
      LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
      ${where}
    `, [userId, ...params])
    const total = countRow.count

    const docs = await db.all(`
      SELECT DISTINCT d.id, d.title, d.status, d.visibility, d.owner_id, d.org_id,
             d.tags, d.word_count, d.current_version, d.created_at, d.updated_at,
             u.username as owner_username, u.avatar_url as owner_avatar,
             COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'creator' ELSE NULL END) as my_role
      FROM documents d
      LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
      LEFT JOIN users u ON d.owner_id = u.id
      ${where}
      ORDER BY d.updated_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, ...params, limit, offset])

    const parsedDocs = docs.map(doc => ({
      ...doc,
      tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })()
    }))

    return res.json({ code: 200, message: 'success', data: paginatedResponse(parsedDocs, total, page, limit) })
  } catch (err) {
    console.error('List documents error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents
router.post('/', authenticateToken, auditLog('document.create'), async (req, res) => {
  try {
    const { title = 'Untitled Document', content = '', status = 'draft', visibility = 'private', tags = [], org_id, dept_id } = req.body
    const userId = req.user.id

    const wordCount = content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length

    const result = await db.run(
      'INSERT INTO documents (title, content, owner_id, org_id, dept_id, status, visibility, tags, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, content, userId, org_id || req.user.org_id || null, dept_id || null, status, visibility, JSON.stringify(tags), wordCount]
    )

    const docId = result.insertId

    await db.run(
      "INSERT INTO document_permissions (document_id, user_id, role, granted_by) VALUES (?, ?, 'creator', ?)",
      [docId, userId, userId]
    )

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId])
    const parsedDoc = { ...doc, tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })() }

    return res.status(201).json({ code: 201, message: '文档创建成功', data: parsedDoc })
  } catch (err) {
    console.error('Create document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/documents/share/:token
router.get('/share/:token', async (req, res) => {
  try {
    const doc = await db.get(`
      SELECT d.id, d.title, d.content, d.status, d.owner_id, d.tags, d.word_count, d.created_at, d.updated_at,
             u.username as owner_username
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.share_token = ? AND d.deleted_at IS NULL
        AND (d.share_expires_at IS NULL OR d.share_expires_at > CURRENT_TIMESTAMP)
    `, [req.params.token])

    if (!doc) {
      return res.status(404).json({ code: 404, message: '分享链接无效或已过期' })
    }

    const parsedDoc = { ...doc, tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })() }
    return res.json({ code: 200, message: 'success', data: parsedDoc })
  } catch (err) {
    console.error('Get shared document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/documents/:id
router.get('/:id', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const doc = await db.get(`
      SELECT d.*, u.username as owner_username, u.avatar_url as owner_avatar
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.id = ? AND d.deleted_at IS NULL
    `, [req.params.id])

    if (!doc) {
      return res.status(404).json({ code: 404, message: '文档不存在' })
    }

    const parsedDoc = {
      ...doc,
      tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })(),
      my_role: req.docPermRole
    }

    return res.json({ code: 200, message: 'success', data: parsedDoc })
  } catch (err) {
    console.error('Get document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/documents/:id
router.put('/:id', authenticateToken, requireDocPermission('write'), auditLog('document.update'), async (req, res) => {
  try {
    const { title, tags, status, visibility } = req.body
    const docId = req.params.id

    const updates = []
    const values = []

    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)) }
    if (status !== undefined) {
      const validStatuses = ['draft', 'published', 'archived']
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ code: 400, message: '无效的状态值' })
      }
      updates.push('status = ?'); values.push(status)
    }
    if (visibility !== undefined) {
      const validVisibilities = ['private', 'org', 'public']
      if (!validVisibilities.includes(visibility)) {
        return res.status(400).json({ code: 400, message: '无效的可见性值' })
      }
      updates.push('visibility = ?'); values.push(visibility)
    }

    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(docId)

    await db.run(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`, values)

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId])
    const parsedDoc = { ...doc, tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })() }

    return res.json({ code: 200, message: '更新成功', data: parsedDoc })
  } catch (err) {
    console.error('Update document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/documents/:id
router.delete('/:id', authenticateToken, requireDocPermission('delete'), auditLog('document.delete'), async (req, res) => {
  try {
    const doc = req.document

    if (doc.owner_id !== req.user.id && req.user.system_role !== 'system_admin' && req.user.org_role !== 'org_admin') {
      return res.status(403).json({ code: 403, message: '只有文档所有者可以删除文档' })
    }

    await db.run('UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id])

    return res.json({ code: 200, message: '文档已删除' })
  } catch (err) {
    console.error('Delete document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/documents/:id/content
router.put('/:id/content', authenticateToken, requireDocPermission('write'), auditLog('document.content_update'), async (req, res) => {
  try {
    const { content, auto_version = false } = req.body
    const docId = req.params.id

    if (content === undefined) {
      return res.status(400).json({ code: 400, message: '内容不能为空' })
    }

    const wordCount = content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length

    await db.run(
      'UPDATE documents SET content = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, wordCount, docId]
    )

    let newVersionNum = null

    const rules = await db.get("SELECT * FROM version_rules WHERE scope = 'global' LIMIT 1")
    if (rules && rules.auto_version_on_save && auto_version) {
      newVersionNum = await saveVersion(parseInt(docId), req.user.id, { summary: '内容保存' })
    }

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId])

    return res.json({
      code: 200,
      message: '内容更新成功',
      data: {
        ...doc,
        tags: (() => { try { return JSON.parse(doc.tags || '[]') } catch { return [] } })(),
        new_version: newVersionNum
      }
    })
  } catch (err) {
    console.error('Update content error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/publish
router.post('/:id/publish', authenticateToken, requireDocPermission('write'), auditLog('document.publish'), async (req, res) => {
  try {
    await db.run("UPDATE documents SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id])
    return res.json({ code: 200, message: '文档已发布' })
  } catch (err) {
    console.error('Publish error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/archive
router.post('/:id/archive', authenticateToken, requireDocPermission('manage'), auditLog('document.archive'), async (req, res) => {
  try {
    await db.run("UPDATE documents SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id])
    return res.json({ code: 200, message: '文档已归档' })
  } catch (err) {
    console.error('Archive error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/share
router.post('/:id/share', authenticateToken, requireDocPermission('manage'), async (req, res) => {
  try {
    const { expires_in_days } = req.body
    const token = uuidv4()

    let expiresAt = null
    if (expires_in_days && parseInt(expires_in_days) > 0) {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + parseInt(expires_in_days))
      expiresAt = expDate.toISOString()
    }

    await db.run(
      'UPDATE documents SET share_token = ?, share_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [token, expiresAt, req.params.id]
    )

    return res.json({
      code: 200,
      message: '分享链接已生成',
      data: { share_token: token, share_expires_at: expiresAt }
    })
  } catch (err) {
    console.error('Share document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/documents/:id/share
router.delete('/:id/share', authenticateToken, requireDocPermission('manage'), async (req, res) => {
  try {
    await db.run('UPDATE documents SET share_token = NULL, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id])
    return res.json({ code: 200, message: '分享链接已撤销' })
  } catch (err) {
    console.error('Revoke share error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/documents/:id/export
router.get('/:id/export', authenticateToken, requireDocPermission('export'), async (req, res) => {
  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [req.params.id])

    if (!doc) {
      return res.status(404).json({ code: 404, message: '文档不存在' })
    }

    const { format = 'html' } = req.query

    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 30px; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <div class="meta">导出时间: ${new Date().toLocaleString('zh-CN')}</div>
  <div class="content">${doc.content}</div>
</body>
</html>`

      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.title)}.html"`)
      return res.send(html)
    } else if (format === 'json') {
      return res.json({ code: 200, message: 'success', data: doc })
    } else {
      return res.status(501).json({ code: 501, message: 'PDF导出功能即将上线' })
    }
  } catch (err) {
    console.error('Export document error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
