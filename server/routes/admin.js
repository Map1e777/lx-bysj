const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireRole } = require('../middleware/roles')
const { parsePagination, paginatedResponse } = require('../utils/pagination')
const { hashPassword } = require('../utils/hash')

router.use(authenticateToken)
router.use(requireRole('system_admin'))

// ===== USER MANAGEMENT =====

// GET /api/admin/users
router.get('/users', async (req, res) => {
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
      SELECT u.id, u.username, u.email, u.system_role, u.org_id, u.org_role,
             u.avatar_url, u.is_active, u.last_login_at, u.created_at,
             o.name as org_name
      FROM users u
      LEFT JOIN orgs o ON u.org_id = o.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(users, total, page, limit) })
  } catch (err) {
    console.error('Admin list users error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, system_role = 'user', org_id, org_role, is_active = 1 } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ code: 400, message: '用户名、邮箱和密码不能为空' })
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
    if (existing) {
      return res.status(409).json({ code: 409, message: '用户名或邮箱已存在' })
    }

    const hash = await hashPassword(password)
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash, system_role, org_id, org_role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hash, system_role, org_id || null, org_role || null, is_active ? 1 : 0]
    )

    const user = await db.get(
      'SELECT id, username, email, system_role, org_id, org_role, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    )
    return res.status(201).json({ code: 201, message: '用户已创建', data: user })
  } catch (err) {
    console.error('Admin create user error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { username, email, password, system_role, org_id, org_role, is_active, avatar_url } = req.body

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP']
    const values = []

    if (username !== undefined) { updates.push('username = ?'); values.push(username) }
    if (email !== undefined) { updates.push('email = ?'); values.push(email) }
    if (system_role !== undefined) { updates.push('system_role = ?'); values.push(system_role) }
    if (org_id !== undefined) { updates.push('org_id = ?'); values.push(org_id || null) }
    if (org_role !== undefined) { updates.push('org_role = ?'); values.push(org_role || null) }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0) }
    if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url) }

    if (password) {
      const hash = await hashPassword(password)
      updates.push('password_hash = ?')
      values.push(hash)
    }

    values.push(req.params.id)
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)

    const updated = await db.get(
      'SELECT id, username, email, system_role, org_id, org_role, is_active, avatar_url, created_at, updated_at FROM users WHERE id = ?',
      [req.params.id]
    )
    return res.json({ code: 200, message: '用户已更新', data: updated })
  } catch (err) {
    console.error('Admin update user error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    if (user.system_role === 'system_admin') {
      const adminCountRow = await db.get("SELECT COUNT(*) as count FROM users WHERE system_role = 'system_admin' AND is_active = 1")
      if (adminCountRow.count <= 1) {
        return res.status(400).json({ code: 400, message: '不能停用最后一个系统管理员' })
      }
    }

    await db.run('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id])
    return res.json({ code: 200, message: '用户已停用' })
  } catch (err) {
    console.error('Admin deactivate user error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : (user.is_active ? 0 : 1)

    if (newStatus === 0 && user.system_role === 'system_admin') {
      const adminCountRow = await db.get("SELECT COUNT(*) as count FROM users WHERE system_role = 'system_admin' AND is_active = 1")
      if (adminCountRow.count <= 1) {
        return res.status(400).json({ code: 400, message: '不能停用最后一个系统管理员' })
      }
    }

    await db.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, req.params.id])
    return res.json({ code: 200, message: newStatus ? '账号已启用' : '账号已停用', data: { is_active: newStatus } })
  } catch (err) {
    console.error('Toggle user status error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== ORGANIZATION MANAGEMENT =====

// GET /api/admin/orgs
router.get('/orgs', async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { search } = req.query

    const conditions = []
    const params = []

    if (search) {
      conditions.push('(o.name LIKE ? OR o.slug LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = await db.get(`SELECT COUNT(*) as count FROM orgs o ${where}`, params)
    const total = countRow.count

    const orgs = await db.all(`
      SELECT o.id, o.name, o.slug, o.description, o.logo_url, o.owner_id, o.created_at, o.updated_at,
             u.username as owner_username,
             (SELECT COUNT(*) FROM users WHERE org_id = o.id) as member_count,
             (SELECT COUNT(*) FROM documents WHERE org_id = o.id AND deleted_at IS NULL) as doc_count
      FROM orgs o
      LEFT JOIN users u ON o.owner_id = u.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(orgs, total, page, limit) })
  } catch (err) {
    console.error('Admin list orgs error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/admin/orgs
router.post('/orgs', async (req, res) => {
  try {
    const { name, slug, description, logo_url, owner_id, settings } = req.body

    if (!name) {
      return res.status(400).json({ code: 400, message: '组织名称不能为空' })
    }

    if (slug) {
      const existing = await db.get('SELECT id FROM orgs WHERE slug = ?', [slug])
      if (existing) {
        return res.status(409).json({ code: 409, message: 'Slug已存在' })
      }
    }

    const result = await db.run(
      'INSERT INTO orgs (name, slug, description, logo_url, owner_id, settings) VALUES (?, ?, ?, ?, ?, ?)',
      [name, slug || null, description || null, logo_url || null, owner_id || null, JSON.stringify(settings || {})]
    )

    const org = await db.get('SELECT * FROM orgs WHERE id = ?', [result.insertId])
    return res.status(201).json({ code: 201, message: '组织已创建', data: org })
  } catch (err) {
    console.error('Admin create org error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/orgs/:id
router.put('/orgs/:id', async (req, res) => {
  try {
    const { name, slug, description, logo_url, owner_id, settings } = req.body

    const org = await db.get('SELECT * FROM orgs WHERE id = ?', [req.params.id])
    if (!org) {
      return res.status(404).json({ code: 404, message: '组织不存在' })
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP']
    const values = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (slug !== undefined) { updates.push('slug = ?'); values.push(slug) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url) }
    if (owner_id !== undefined) { updates.push('owner_id = ?'); values.push(owner_id) }
    if (settings !== undefined) { updates.push('settings = ?'); values.push(JSON.stringify(settings)) }

    values.push(req.params.id)
    await db.run(`UPDATE orgs SET ${updates.join(', ')} WHERE id = ?`, values)

    const updated = await db.get('SELECT * FROM orgs WHERE id = ?', [req.params.id])
    return res.json({ code: 200, message: '组织已更新', data: updated })
  } catch (err) {
    console.error('Admin update org error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/admin/orgs/:id
router.delete('/orgs/:id', async (req, res) => {
  try {
    const org = await db.get('SELECT * FROM orgs WHERE id = ?', [req.params.id])
    if (!org) {
      return res.status(404).json({ code: 404, message: '组织不存在' })
    }

    await db.transaction(async (conn) => {
      await conn.query('UPDATE users SET org_id = NULL, org_role = NULL WHERE org_id = ?', [org.id])
      await conn.query('DELETE FROM orgs WHERE id = ?', [org.id])
    })

    return res.json({ code: 200, message: '组织已删除' })
  } catch (err) {
    console.error('Admin delete org error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== PERMISSION TEMPLATES =====

// GET /api/admin/permission-templates
router.get('/permission-templates', async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const countRow = await db.get('SELECT COUNT(*) as count FROM permission_templates')
    const total = countRow.count

    const templates = await db.all(`
      SELECT pt.*, u.username as created_by_username
      FROM permission_templates pt
      LEFT JOIN users u ON pt.created_by = u.id
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset])

    const parsed = templates.map(t => ({
      ...t,
      rules: (() => { try { return JSON.parse(t.rules || '[]') } catch { return [] } })()
    }))

    return res.json({ code: 200, message: 'success', data: paginatedResponse(parsed, total, page, limit) })
  } catch (err) {
    console.error('List permission templates error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/admin/permission-templates
router.post('/permission-templates', async (req, res) => {
  try {
    const { name, description, scope = 'global', org_id, rules = [] } = req.body

    if (!name) {
      return res.status(400).json({ code: 400, message: '模板名称不能为空' })
    }

    const result = await db.run(
      'INSERT INTO permission_templates (name, description, scope, org_id, rules, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, scope, org_id || null, JSON.stringify(rules), req.user.id]
    )

    const template = await db.get('SELECT * FROM permission_templates WHERE id = ?', [result.insertId])
    return res.status(201).json({ code: 201, message: '模板已创建', data: template })
  } catch (err) {
    console.error('Create permission template error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/permission-templates/:id
router.put('/permission-templates/:id', async (req, res) => {
  try {
    const { name, description, scope, org_id, rules } = req.body

    const template = await db.get('SELECT * FROM permission_templates WHERE id = ?', [req.params.id])
    if (!template) {
      return res.status(404).json({ code: 404, message: '模板不存在' })
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP']
    const values = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (scope !== undefined) { updates.push('scope = ?'); values.push(scope) }
    if (org_id !== undefined) { updates.push('org_id = ?'); values.push(org_id || null) }
    if (rules !== undefined) { updates.push('rules = ?'); values.push(JSON.stringify(rules)) }

    values.push(req.params.id)
    await db.run(`UPDATE permission_templates SET ${updates.join(', ')} WHERE id = ?`, values)

    const updated = await db.get('SELECT * FROM permission_templates WHERE id = ?', [req.params.id])
    return res.json({ code: 200, message: '模板已更新', data: updated })
  } catch (err) {
    console.error('Update permission template error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/admin/permission-templates/:id
router.delete('/permission-templates/:id', async (req, res) => {
  try {
    const template = await db.get('SELECT * FROM permission_templates WHERE id = ?', [req.params.id])
    if (!template) {
      return res.status(404).json({ code: 404, message: '模板不存在' })
    }
    await db.run('DELETE FROM permission_templates WHERE id = ?', [req.params.id])
    return res.json({ code: 200, message: '模板已删除' })
  } catch (err) {
    console.error('Delete permission template error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== VERSION RULES =====

// GET /api/admin/version-rules
router.get('/version-rules', async (req, res) => {
  try {
    const rules = await db.all('SELECT * FROM version_rules ORDER BY scope ASC, created_at ASC')
    return res.json({ code: 200, message: 'success', data: rules })
  } catch (err) {
    console.error('Get version rules error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/version-rules
router.put('/version-rules', async (req, res) => {
  try {
    const { auto_save_interval, max_versions_per_doc, auto_version_on_save, version_retention_days, scope = 'global', org_id } = req.body

    const existing = await db.get(
      'SELECT * FROM version_rules WHERE scope = ? AND (org_id = ? OR (org_id IS NULL AND ? IS NULL)) LIMIT 1',
      [scope, org_id || null, org_id || null]
    )

    if (existing) {
      const updates = ['updated_at = CURRENT_TIMESTAMP']
      const values = []

      if (auto_save_interval !== undefined) { updates.push('auto_save_interval = ?'); values.push(auto_save_interval) }
      if (max_versions_per_doc !== undefined) { updates.push('max_versions_per_doc = ?'); values.push(max_versions_per_doc) }
      if (auto_version_on_save !== undefined) { updates.push('auto_version_on_save = ?'); values.push(auto_version_on_save ? 1 : 0) }
      if (version_retention_days !== undefined) { updates.push('version_retention_days = ?'); values.push(version_retention_days) }

      values.push(existing.id)
      await db.run(`UPDATE version_rules SET ${updates.join(', ')} WHERE id = ?`, values)
    } else {
      await db.run(
        'INSERT INTO version_rules (scope, org_id, auto_save_interval, max_versions_per_doc, auto_version_on_save, version_retention_days) VALUES (?, ?, ?, ?, ?, ?)',
        [scope, org_id || null, auto_save_interval ?? 300, max_versions_per_doc ?? 100, auto_version_on_save !== undefined ? (auto_version_on_save ? 1 : 0) : 1, version_retention_days ?? 365]
      )
    }

    const rule = await db.get('SELECT * FROM version_rules WHERE scope = ? ORDER BY id DESC LIMIT 1', [scope])
    return res.json({ code: 200, message: '版本规则已更新', data: rule })
  } catch (err) {
    console.error('Update version rules error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== AUDIT LOGS =====

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { actor_id, action, resource_type, from_date, to_date } = req.query

    const conditions = []
    const params = []

    if (actor_id) { conditions.push('al.actor_id = ?'); params.push(parseInt(actor_id)) }
    if (action) { conditions.push('al.action LIKE ?'); params.push(`%${action}%`) }
    if (resource_type) { conditions.push('al.resource_type = ?'); params.push(resource_type) }
    if (from_date) { conditions.push('al.created_at >= ?'); params.push(from_date) }
    if (to_date) { conditions.push('al.created_at <= ?'); params.push(to_date) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = await db.get(`SELECT COUNT(*) as count FROM audit_logs al ${where}`, params)
    const total = countRow.count

    const logs = await db.all(`
      SELECT al.*, u.username as actor_username
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(logs, total, page, limit) })
  } catch (err) {
    console.error('Get audit logs error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== STATS =====

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers, activeUsers, totalOrgs, totalDocs, publishedDocs,
      totalVersions, totalComments, totalAttachments, unreadNotifications,
      recentUsers, recentDocs
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM users'),
      db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
      db.get('SELECT COUNT(*) as count FROM orgs'),
      db.get('SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL'),
      db.get("SELECT COUNT(*) as count FROM documents WHERE status = 'published' AND deleted_at IS NULL"),
      db.get('SELECT COUNT(*) as count FROM document_versions'),
      db.get('SELECT COUNT(*) as count FROM comments WHERE deleted_at IS NULL'),
      db.get('SELECT COUNT(*) as count FROM attachments'),
      db.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0'),
      db.get('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
      db.get('SELECT COUNT(*) as count FROM documents WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND deleted_at IS NULL')
    ])

    return res.json({
      code: 200,
      message: 'success',
      data: {
        users: { total: totalUsers.count, active: activeUsers.count, recent_7d: recentUsers.count },
        organizations: { total: totalOrgs.count },
        documents: { total: totalDocs.count, published: publishedDocs.count, recent_7d: recentDocs.count },
        versions: { total: totalVersions.count },
        comments: { total: totalComments.count },
        attachments: { total: totalAttachments.count },
        notifications: { unread: unreadNotifications.count }
      }
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== SYSTEM CONFIG =====

// GET /api/admin/config
router.get('/config', async (req, res) => {
  try {
    const configs = await db.all('SELECT `key`, value, updated_at FROM system_config ORDER BY `key` ASC')

    const configMap = {}
    configs.forEach(c => {
      try { configMap[c.key] = { value: JSON.parse(c.value), updated_at: c.updated_at } } catch { configMap[c.key] = { value: c.value, updated_at: c.updated_at } }
    })

    return res.json({ code: 200, message: 'success', data: configMap })
  } catch (err) {
    console.error('Get config error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/config
router.put('/config', async (req, res) => {
  try {
    const { configs } = req.body

    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ code: 400, message: '配置数据格式错误' })
    }

    await db.transaction(async (conn) => {
      for (const [key, value] of Object.entries(configs)) {
        await conn.query(
          'INSERT INTO system_config (`key`, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP',
          [key, JSON.stringify(value), req.user.id]
        )
      }
    })

    return res.json({ code: 200, message: '配置已更新' })
  } catch (err) {
    console.error('Update config error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
