const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireRole } = require('../middleware/roles')
const { parsePagination, paginatedResponse } = require('../utils/pagination')
const { hashPassword } = require('../utils/hash')
const { formatRoleProfile } = require('../utils/roleProfile')

router.use(authenticateToken)
router.use(requireRole('system_admin'))

function withRoleProfile(user) {
  return {
    ...user,
    role_profile: formatRoleProfile(
      user,
      user.owned_document_count || 0,
      user.collaborated_document_count || 0
    )
  }
}

// ===== USER MANAGEMENT =====

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { search, system_role, is_active, org_id, role_code } = req.query

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
    if (role_code === 'org_admin') {
      conditions.push("u.org_role = 'org_admin'")
    }
    if (role_code === 'doc_creator') {
      conditions.push('EXISTS (SELECT 1 FROM documents d WHERE d.owner_id = u.id AND d.deleted_at IS NULL)')
    }
    if (role_code === 'doc_collaborator') {
      conditions.push("EXISTS (SELECT 1 FROM document_permissions dp WHERE dp.user_id = u.id AND dp.role IN ('editor', 'commenter', 'viewer'))")
    }
    if (role_code === 'user') {
      conditions.push("u.system_role <> 'system_admin'")
      conditions.push("(u.org_role IS NULL OR u.org_role <> 'org_admin')")
      conditions.push('NOT EXISTS (SELECT 1 FROM documents d WHERE d.owner_id = u.id AND d.deleted_at IS NULL)')
      conditions.push("NOT EXISTS (SELECT 1 FROM document_permissions dp WHERE dp.user_id = u.id AND dp.role IN ('editor', 'commenter', 'viewer'))")
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = await db.get(`SELECT COUNT(*) as count FROM users u ${where}`, params)
    const total = countRow.count

    const users = await db.all(`
      SELECT u.id, u.username, u.email, u.system_role, u.org_id, u.org_role,
             u.avatar_url, u.is_active, u.last_login_at, u.created_at,
             o.name as org_name,
             (SELECT COUNT(*) FROM documents d WHERE d.owner_id = u.id AND d.deleted_at IS NULL) as owned_document_count,
             (SELECT COUNT(*) FROM document_permissions dp WHERE dp.user_id = u.id AND dp.role IN ('editor', 'commenter', 'viewer')) as collaborated_document_count
      FROM users u
      LEFT JOIN orgs o ON u.org_id = o.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({
      code: 200,
      message: 'success',
      data: paginatedResponse(users.map(withRoleProfile), total, page, limit)
    })
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

// GET /api/admin/orgs/:id
router.get('/orgs/:id', async (req, res) => {
  try {
    const org = await db.get(`
      SELECT o.id, o.name, o.slug, o.description, o.logo_url, o.owner_id, o.settings, o.created_at, o.updated_at,
             u.username as owner_username,
             (SELECT COUNT(*) FROM users WHERE org_id = o.id) as member_count,
             (SELECT COUNT(*) FROM documents WHERE org_id = o.id AND deleted_at IS NULL) as doc_count
      FROM orgs o
      LEFT JOIN users u ON o.owner_id = u.id
      WHERE o.id = ?
    `, [req.params.id])

    if (!org) {
      return res.status(404).json({ code: 404, message: '组织不存在' })
    }

    return res.json({
      code: 200,
      message: 'success',
      data: {
        ...org,
        settings: (() => { try { return JSON.parse(org.settings || '{}') } catch { return {} } })()
      }
    })
  } catch (err) {
    console.error('Admin get org detail error:', err)
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
    const { name, description, scope = 'global', org_id, rules, permissions } = req.body
    const normalizedRules = rules ?? permissions ?? {}

    if (!name) {
      return res.status(400).json({ code: 400, message: '模板名称不能为空' })
    }

    const result = await db.run(
      'INSERT INTO permission_templates (name, description, scope, org_id, rules, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, scope, org_id || null, JSON.stringify(normalizedRules), req.user.id]
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
    const { name, description, scope, org_id, rules, permissions } = req.body

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
    const normalizedRules = rules ?? permissions
    if (normalizedRules !== undefined) { updates.push('rules = ?'); values.push(JSON.stringify(normalizedRules)) }

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
    const { actor_id, action, resource_type, from_date, to_date, start_date, end_date, actor, org_id } = req.query

    const conditions = []
    const params = []

    if (actor_id) { conditions.push('al.actor_id = ?'); params.push(parseInt(actor_id)) }
    if (actor) { conditions.push('actor_u.username LIKE ?'); params.push(`%${actor}%`) }
    if (action) { conditions.push('al.action LIKE ?'); params.push(`%${action}%`) }
    if (resource_type) { conditions.push('al.resource_type = ?'); params.push(resource_type) }
    if (from_date || start_date) { conditions.push('al.created_at >= ?'); params.push(from_date || start_date) }
    if (to_date || end_date) { conditions.push('al.created_at <= ?'); params.push(to_date || end_date) }
    if (org_id) {
      conditions.push('(doc.org_id = ? OR actor_u.org_id = ? OR resource_org.id = ?)')
      params.push(parseInt(org_id), parseInt(org_id), parseInt(org_id))
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = await db.get(`
      SELECT COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users actor_u ON al.actor_id = actor_u.id
      LEFT JOIN documents doc ON al.resource_type = 'document' AND CAST(al.resource_id AS UNSIGNED) = doc.id
      LEFT JOIN orgs resource_org ON al.resource_type = 'org' AND CAST(al.resource_id AS UNSIGNED) = resource_org.id
      ${where}
    `, params)
    const total = countRow.count

    const logs = await db.all(`
      SELECT al.*,
             actor_u.username as actor_username,
             doc.title as document_title,
             COALESCE(doc.org_id, actor_u.org_id, resource_org.id) as org_id,
             COALESCE(doc_org.name, actor_org.name, resource_org.name) as org_name
      FROM audit_logs al
      LEFT JOIN users actor_u ON al.actor_id = actor_u.id
      LEFT JOIN documents doc ON al.resource_type = 'document' AND CAST(al.resource_id AS UNSIGNED) = doc.id
      LEFT JOIN orgs actor_org ON actor_u.org_id = actor_org.id
      LEFT JOIN orgs doc_org ON doc.org_id = doc_org.id
      LEFT JOIN orgs resource_org ON al.resource_type = 'org' AND CAST(al.resource_id AS UNSIGNED) = resource_org.id
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
    const scopedOrgId = req.query.org_id ? parseInt(req.query.org_id) : null
    const userWhere = scopedOrgId ? 'WHERE org_id = ?' : ''
    const userParams = scopedOrgId ? [scopedOrgId] : []
    const docWhere = scopedOrgId ? 'WHERE org_id = ? AND deleted_at IS NULL' : 'WHERE deleted_at IS NULL'
    const docParams = scopedOrgId ? [scopedOrgId] : []
    const publishedDocWhere = scopedOrgId
      ? "WHERE org_id = ? AND status = 'published' AND deleted_at IS NULL"
      : "WHERE status = 'published' AND deleted_at IS NULL"
    const recentUserWhere = scopedOrgId
      ? 'WHERE org_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
      : 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    const recentDocWhere = scopedOrgId
      ? 'WHERE org_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND deleted_at IS NULL'
      : 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND deleted_at IS NULL'

    const [
      totalUsers, activeUsers, totalOrgs, totalDocs, publishedDocs,
      totalVersions, totalComments, totalAttachments, unreadNotifications,
      recentUsers, recentDocs, orgContext, orgBreakdown, roleDistribution,
      storageUsage, activeToday
    ] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM users ${userWhere}`, userParams),
      db.get(
        `SELECT COUNT(*) as count FROM users ${scopedOrgId ? 'WHERE org_id = ? AND is_active = 1' : 'WHERE is_active = 1'}`,
        userParams
      ),
      db.get(scopedOrgId ? 'SELECT COUNT(*) as count FROM orgs WHERE id = ?' : 'SELECT COUNT(*) as count FROM orgs', scopedOrgId ? [scopedOrgId] : []),
      db.get(`SELECT COUNT(*) as count FROM documents ${docWhere}`, docParams),
      db.get(`SELECT COUNT(*) as count FROM documents ${publishedDocWhere}`, docParams),
      db.get(
        scopedOrgId
          ? 'SELECT COUNT(*) as count FROM document_versions dv INNER JOIN documents d ON dv.document_id = d.id WHERE d.org_id = ? AND d.deleted_at IS NULL'
          : 'SELECT COUNT(*) as count FROM document_versions',
        docParams
      ),
      db.get(
        scopedOrgId
          ? 'SELECT COUNT(*) as count FROM comments c INNER JOIN documents d ON c.document_id = d.id WHERE d.org_id = ? AND c.deleted_at IS NULL AND d.deleted_at IS NULL'
          : 'SELECT COUNT(*) as count FROM comments WHERE deleted_at IS NULL',
        docParams
      ),
      db.get(
        scopedOrgId
          ? 'SELECT COUNT(*) as count FROM attachments a INNER JOIN documents d ON a.document_id = d.id WHERE d.org_id = ? AND d.deleted_at IS NULL'
          : 'SELECT COUNT(*) as count FROM attachments',
        docParams
      ),
      db.get(
        scopedOrgId
          ? 'SELECT COUNT(*) as count FROM notifications n INNER JOIN users u ON n.user_id = u.id WHERE u.org_id = ? AND n.is_read = 0'
          : 'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0',
        userParams
      ),
      db.get(`SELECT COUNT(*) as count FROM users ${recentUserWhere}`, userParams),
      db.get(`SELECT COUNT(*) as count FROM documents ${recentDocWhere}`, docParams),
      scopedOrgId ? db.get('SELECT id, name, slug, description FROM orgs WHERE id = ?', [scopedOrgId]) : Promise.resolve(null),
      db.all(`
        SELECT o.id, o.name,
               COUNT(DISTINCT u.id) as user_count,
               COUNT(DISTINCT d.id) as document_count,
               COUNT(DISTINCT dv.id) as version_count
        FROM orgs o
        LEFT JOIN users u ON u.org_id = o.id
        LEFT JOIN documents d ON d.org_id = o.id AND d.deleted_at IS NULL
        LEFT JOIN document_versions dv ON dv.document_id = d.id
        ${scopedOrgId ? 'WHERE o.id = ?' : ''}
        GROUP BY o.id, o.name
        ORDER BY document_count DESC, user_count DESC, o.id ASC
        LIMIT 10
      `, scopedOrgId ? [scopedOrgId] : []),
      Promise.all([
        db.get(`SELECT COUNT(*) as count FROM users ${scopedOrgId ? "WHERE org_id = ? AND system_role = 'system_admin'" : "WHERE system_role = 'system_admin'"} `, userParams),
        db.get(`SELECT COUNT(*) as count FROM users ${scopedOrgId ? "WHERE org_id = ? AND org_role = 'org_admin'" : "WHERE org_role = 'org_admin'"} `, userParams),
        db.get(
          scopedOrgId
            ? 'SELECT COUNT(DISTINCT owner_id) as count FROM documents WHERE org_id = ? AND deleted_at IS NULL'
            : 'SELECT COUNT(DISTINCT owner_id) as count FROM documents WHERE deleted_at IS NULL',
          docParams
        ),
        db.get(
          scopedOrgId
            ? "SELECT COUNT(DISTINCT dp.user_id) as count FROM document_permissions dp INNER JOIN documents d ON dp.document_id = d.id WHERE d.org_id = ? AND d.deleted_at IS NULL AND dp.role IN ('editor', 'commenter', 'viewer')"
            : "SELECT COUNT(DISTINCT user_id) as count FROM document_permissions WHERE role IN ('editor', 'commenter', 'viewer')",
          docParams
        ),
        db.get(
          `
            SELECT COUNT(*) as count
            FROM users u
            WHERE ${scopedOrgId ? 'u.org_id = ? AND' : ''}
                  u.system_role <> 'system_admin'
              AND (u.org_role IS NULL OR u.org_role <> 'org_admin')
              AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.owner_id = u.id AND d.deleted_at IS NULL ${scopedOrgId ? 'AND d.org_id = ?' : ''})
              AND NOT EXISTS (
                SELECT 1
                FROM document_permissions dp
                INNER JOIN documents d2 ON dp.document_id = d2.id
                WHERE dp.user_id = u.id
                  AND dp.role IN ('editor', 'commenter', 'viewer')
                  ${scopedOrgId ? 'AND d2.org_id = ?' : ''}
                  AND d2.deleted_at IS NULL
              )
          `,
          scopedOrgId ? [scopedOrgId, scopedOrgId, scopedOrgId] : []
        )
      ]),
      db.get(
        scopedOrgId
          ? 'SELECT COALESCE(SUM(a.file_size), 0) as total_size FROM attachments a INNER JOIN documents d ON a.document_id = d.id WHERE d.org_id = ? AND d.deleted_at IS NULL'
          : 'SELECT COALESCE(SUM(file_size), 0) as total_size FROM attachments',
        docParams
      ),
      db.get(
        scopedOrgId
          ? 'SELECT COUNT(*) as count FROM users WHERE org_id = ? AND last_login_at >= CURDATE()'
          : 'SELECT COUNT(*) as count FROM users WHERE last_login_at >= CURDATE()',
        userParams
      )
    ])

    const [systemAdmins, orgAdmins, docCreators, docCollaborators, plainUsers] = roleDistribution

    return res.json({
      code: 200,
      message: 'success',
      data: {
        org_id: scopedOrgId,
        org_context: orgContext,
        total_users: totalUsers.count,
        active_users: activeUsers.count,
        total_orgs: totalOrgs.count,
        total_documents: totalDocs.count,
        published_documents: publishedDocs.count,
        total_versions: totalVersions.count,
        total_comments: totalComments.count,
        total_attachments: totalAttachments.count,
        unread_notifications: unreadNotifications.count,
        users_recent_7d: recentUsers.count,
        documents_recent_7d: recentDocs.count,
        storage_used: `${(Number(storageUsage.total_size || 0) / 1024 / 1024).toFixed(1)} MB`,
        active_today: activeToday.count,
        role_distribution: {
          system_admin: systemAdmins.count,
          org_admin: orgAdmins.count,
          doc_creator: docCreators.count,
          doc_collaborator: docCollaborators.count,
          user: plainUsers.count
        },
        org_breakdown: orgBreakdown,
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

    return res.json({
      code: 200,
      message: 'success',
      data: {
        platform_name: configMap.platform_name?.value,
        registration_open: configMap.allow_registration?.value,
        allow_registration: configMap.allow_registration?.value,
        max_upload_size: configMap.max_upload_size?.value,
        maintenance_mode: configMap.maintenance_mode?.value,
        items: configMap
      }
    })
  } catch (err) {
    console.error('Get config error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/admin/config
router.put('/config', async (req, res) => {
  try {
    const inputConfigs = req.body.configs && typeof req.body.configs === 'object'
      ? req.body.configs
      : req.body

    if (!inputConfigs || typeof inputConfigs !== 'object') {
      return res.status(400).json({ code: 400, message: '配置数据格式错误' })
    }

    const configKeyMap = {
      registration_open: 'allow_registration',
      allow_registration: 'allow_registration',
      platform_name: 'platform_name',
      max_upload_size: 'max_upload_size',
      maintenance_mode: 'maintenance_mode'
    }

    await db.transaction(async (conn) => {
      for (const [rawKey, value] of Object.entries(inputConfigs)) {
        const key = configKeyMap[rawKey] || rawKey
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
