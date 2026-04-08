const { db } = require('../db')

function requireDocPermission(action) {
  return async (req, res, next) => {
    const docId = req.params.id || req.params.docId
    const userId = req.user.id

    try {
      if (req.user.system_role === 'system_admin') {
        const doc = await db.get('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [docId])
        if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })
        req.document = doc
        req.docPermRole = 'creator'
        return next()
      }

      const doc = await db.get('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', [docId])
      if (!doc) return res.status(404).json({ code: 404, message: '文档不存在' })

      if (doc.owner_id === userId) {
        req.document = doc
        req.docPermRole = 'creator'
        return next()
      }

      if (req.user.org_role === 'org_admin' && doc.org_id && doc.org_id === req.user.org_id) {
        req.document = doc
        req.docPermRole = 'creator'
        return next()
      }

      if (action === 'read' && doc.visibility === 'public') {
        req.document = doc
        req.docPermRole = 'viewer'
        return next()
      }

      if (action === 'read' && doc.visibility === 'org' && doc.org_id && doc.org_id === req.user.org_id) {
        req.document = doc
        req.docPermRole = 'viewer'
        return next()
      }

      const perm = await db.get('SELECT role, expires_at FROM document_permissions WHERE document_id = ? AND user_id = ?', [docId, userId])
      if (!perm) return res.status(403).json({ code: 403, message: '无文档访问权限' })

      if (perm.expires_at && new Date(perm.expires_at) < new Date()) {
        return res.status(403).json({ code: 403, message: '文档访问权限已过期' })
      }

      if (!checkPermission(perm.role, action)) return res.status(403).json({ code: 403, message: '权限不足' })

      req.docPermRole = perm.role
      req.document = doc
      next()
    } catch (err) {
      console.error('Permission check error:', err)
      return res.status(500).json({ code: 500, message: '服务器错误' })
    }
  }
}

function checkPermission(role, action) {
  const matrix = {
    creator: ['read', 'write', 'manage', 'delete', 'version_manage', 'version_save', 'comment', 'export'],
    editor:  ['read', 'write', 'comment', 'version_save', 'export'],
    viewer:  ['read', 'comment', 'export']
  }
  return matrix[role]?.includes(action) ?? false
}

module.exports = { requireDocPermission, checkPermission }
