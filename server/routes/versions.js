const express = require('express')
const router = express.Router({ mergeParams: true })
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireDocPermission } = require('../middleware/permissions')
const { saveVersion } = require('../services/versionService')
const { getDiffHTML } = require('../utils/diff')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

// GET /api/documents/:id/versions
router.get('/:id/versions', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const docId = req.params.id

    const countRow = await db.get('SELECT COUNT(*) as count FROM document_versions WHERE document_id = ?', [docId])
    const total = countRow.count

    const versions = await db.all(`
      SELECT dv.id, dv.version_num, dv.title, dv.word_count, dv.label, dv.change_summary, dv.is_major, dv.created_at,
             u.username as created_by_username, u.avatar_url as created_by_avatar
      FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
      WHERE dv.document_id = ?
      ORDER BY dv.version_num DESC
      LIMIT ? OFFSET ?
    `, [docId, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(versions, total, page, limit) })
  } catch (err) {
    console.error('List versions error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/versions
router.post('/:id/versions', authenticateToken, requireDocPermission('version_save'), async (req, res) => {
  try {
    const { label, summary, is_major = false } = req.body
    const docId = parseInt(req.params.id)

    const versionNum = await saveVersion(docId, req.user.id, {
      label,
      summary: summary || '手动保存',
      isMajor: is_major
    })

    const version = await db.get(`
      SELECT dv.*, u.username as created_by_username
      FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
      WHERE dv.document_id = ? AND dv.version_num = ?
    `, [docId, versionNum])

    return res.status(201).json({ code: 201, message: '版本已创建', data: version })
  } catch (err) {
    console.error('Create version error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/documents/:id/versions/diff
router.get('/:id/versions/diff', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const { from, to } = req.query
    const docId = req.params.id

    if (!from || !to) {
      return res.status(400).json({ code: 400, message: '请提供from和to版本号' })
    }

    const fromVersion = await db.get('SELECT * FROM document_versions WHERE document_id = ? AND version_num = ?', [docId, parseInt(from)])
    const toVersion = await db.get('SELECT * FROM document_versions WHERE document_id = ? AND version_num = ?', [docId, parseInt(to)])

    if (!fromVersion || !toVersion) {
      return res.status(404).json({ code: 404, message: '指定版本不存在' })
    }

    const diffHtml = getDiffHTML(fromVersion.content, toVersion.content)

    return res.json({
      code: 200,
      message: 'success',
      data: {
        from: { version_num: fromVersion.version_num, title: fromVersion.title, created_at: fromVersion.created_at },
        to: { version_num: toVersion.version_num, title: toVersion.title, created_at: toVersion.created_at },
        diff_html: diffHtml
      }
    })
  } catch (err) {
    console.error('Diff versions error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/documents/:id/versions/:vnum
router.get('/:id/versions/:vnum', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const version = await db.get(`
      SELECT dv.*, u.username as created_by_username, u.avatar_url as created_by_avatar
      FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
      WHERE dv.document_id = ? AND dv.version_num = ?
    `, [req.params.id, req.params.vnum])

    if (!version) {
      return res.status(404).json({ code: 404, message: '版本不存在' })
    }

    return res.json({ code: 200, message: 'success', data: version })
  } catch (err) {
    console.error('Get version error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/documents/:id/versions/:vnum
router.put('/:id/versions/:vnum', authenticateToken, requireDocPermission('version_manage'), async (req, res) => {
  try {
    const { label, change_summary } = req.body

    const version = await db.get('SELECT * FROM document_versions WHERE document_id = ? AND version_num = ?', [req.params.id, req.params.vnum])
    if (!version) {
      return res.status(404).json({ code: 404, message: '版本不存在' })
    }

    const updates = []
    const values = []

    if (label !== undefined) { updates.push('label = ?'); values.push(label) }
    if (change_summary !== undefined) { updates.push('change_summary = ?'); values.push(change_summary) }

    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }

    values.push(version.id)
    await db.run(`UPDATE document_versions SET ${updates.join(', ')} WHERE id = ?`, values)

    const updated = await db.get('SELECT * FROM document_versions WHERE id = ?', [version.id])
    return res.json({ code: 200, message: '版本信息已更新', data: updated })
  } catch (err) {
    console.error('Update version error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/versions/:vnum/restore
router.post('/:id/versions/:vnum/restore', authenticateToken, requireDocPermission('version_manage'), async (req, res) => {
  try {
    const docId = parseInt(req.params.id)
    const vnum = parseInt(req.params.vnum)

    const version = await db.get('SELECT * FROM document_versions WHERE document_id = ? AND version_num = ?', [docId, vnum])
    if (!version) {
      return res.status(404).json({ code: 404, message: '版本不存在' })
    }

    const wordCount = version.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length

    await db.run(
      'UPDATE documents SET title = ?, content = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [version.title, version.content, wordCount, docId]
    )

    const newVersionNum = await saveVersion(docId, req.user.id, {
      summary: `从版本 ${vnum} 恢复`,
      isMajor: true
    })

    return res.json({
      code: 200,
      message: `已恢复到版本 ${vnum}，新版本号为 ${newVersionNum}`,
      data: { restored_from: vnum, new_version: newVersionNum }
    })
  } catch (err) {
    console.error('Restore version error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
