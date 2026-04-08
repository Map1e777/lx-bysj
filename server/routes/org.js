const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireRole } = require('../middleware/roles')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

router.use(authenticateToken)
router.use(requireRole('org_admin'))

function ensureOrgContext(req, res) {
  if (!req.user.org_id) {
    res.status(400).json({ code: 400, message: '您不属于任何组织' })
    return false
  }
  return true
}

// GET /api/org/members
router.get('/members', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { search, org_role } = req.query
    const orgId = req.user.org_id

    const conditions = ['u.org_id = ?']
    const params = [orgId]

    if (search) {
      conditions.push('(u.username LIKE ? OR u.email LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (org_role) { conditions.push('u.org_role = ?'); params.push(org_role) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const countRow = await db.get(`SELECT COUNT(*) as count FROM users u ${where}`, params)
    const total = countRow.count

    const members = await db.all(`
      SELECT u.id, u.username, u.email, u.system_role, u.org_role, u.avatar_url,
             u.dept_id, u.is_active, u.last_login_at, u.created_at,
             d.name as dept_name
      FROM users u
      LEFT JOIN departments d ON u.dept_id = d.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(members, total, page, limit) })
  } catch (err) {
    console.error('List org members error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/org/members/invite
router.post('/members/invite', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { email, org_role = 'member', dept_id } = req.body
    const orgId = req.user.org_id

    if (!email) {
      return res.status(400).json({ code: 400, message: '邮箱不能为空' })
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在，请先注册' })
    }

    if (user.org_id && user.org_id !== orgId) {
      return res.status(409).json({ code: 409, message: '该用户已加入其他组织' })
    }

    if (user.org_id === orgId) {
      return res.status(409).json({ code: 409, message: '该用户已在本组织中' })
    }

    await db.run(
      'UPDATE users SET org_id = ?, org_role = ?, dept_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [orgId, org_role, dept_id || null, user.id]
    )

    return res.json({ code: 200, message: '用户已添加到组织', data: { user_id: user.id, org_role } })
  } catch (err) {
    console.error('Invite org member error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/org/members/:uid
router.delete('/members/:uid', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const targetId = req.params.uid
    const orgId = req.user.org_id

    const user = await db.get('SELECT * FROM users WHERE id = ? AND org_id = ?', [targetId, orgId])
    if (!user) {
      return res.status(404).json({ code: 404, message: '成员不存在或不在本组织中' })
    }

    const org = await db.get('SELECT owner_id FROM orgs WHERE id = ?', [orgId])
    if (org && org.owner_id === parseInt(targetId)) {
      return res.status(400).json({ code: 400, message: '不能移除组织所有者' })
    }

    await db.run('UPDATE users SET org_id = NULL, org_role = NULL, dept_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetId])

    return res.json({ code: 200, message: '成员已移除' })
  } catch (err) {
    console.error('Remove org member error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/org/members/:uid/role
router.put('/members/:uid/role', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { org_role, dept_id } = req.body
    const targetId = req.params.uid
    const orgId = req.user.org_id

    if (!org_role) {
      return res.status(400).json({ code: 400, message: '角色不能为空' })
    }

    const user = await db.get('SELECT * FROM users WHERE id = ? AND org_id = ?', [targetId, orgId])
    if (!user) {
      return res.status(404).json({ code: 404, message: '成员不存在' })
    }

    const updates = ['org_role = ?', 'updated_at = CURRENT_TIMESTAMP']
    const values = [org_role]

    if (dept_id !== undefined) { updates.push('dept_id = ?'); values.push(dept_id) }

    values.push(targetId)
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)

    return res.json({ code: 200, message: '角色已更新' })
  } catch (err) {
    console.error('Change org role error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/org/departments
router.get('/departments', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const orgId = req.user.org_id

    const depts = await db.all(`
      SELECT d.id, d.parent_id, d.name, d.created_at,
             COUNT(u.id) as member_count
      FROM departments d
      LEFT JOIN users u ON u.dept_id = d.id
      WHERE d.org_id = ?
      GROUP BY d.id
      ORDER BY d.parent_id ASC, d.name ASC
    `, [orgId])

    const map = {}
    const roots = []
    depts.forEach(d => { map[d.id] = { ...d, children: [] } })
    depts.forEach(d => {
      if (d.parent_id && map[d.parent_id]) {
        map[d.parent_id].children.push(map[d.id])
      } else {
        roots.push(map[d.id])
      }
    })

    return res.json({ code: 200, message: 'success', data: roots })
  } catch (err) {
    console.error('List departments error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/org/departments
router.post('/departments', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { name, parent_id } = req.body
    const orgId = req.user.org_id

    if (!name || !name.trim()) {
      return res.status(400).json({ code: 400, message: '部门名称不能为空' })
    }

    if (parent_id) {
      const parent = await db.get('SELECT id FROM departments WHERE id = ? AND org_id = ?', [parent_id, orgId])
      if (!parent) {
        return res.status(400).json({ code: 400, message: '父部门不存在' })
      }
    }

    const result = await db.run(
      'INSERT INTO departments (org_id, parent_id, name) VALUES (?, ?, ?)',
      [orgId, parent_id || null, name.trim()]
    )
    const dept = await db.get('SELECT * FROM departments WHERE id = ?', [result.insertId])

    return res.status(201).json({ code: 201, message: '部门已创建', data: dept })
  } catch (err) {
    console.error('Create department error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/org/departments/:id
router.put('/departments/:id', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { name, parent_id } = req.body
    const orgId = req.user.org_id

    const dept = await db.get('SELECT * FROM departments WHERE id = ? AND org_id = ?', [req.params.id, orgId])
    if (!dept) {
      return res.status(404).json({ code: 404, message: '部门不存在' })
    }

    const updates = []
    const values = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()) }
    if (parent_id !== undefined) { updates.push('parent_id = ?'); values.push(parent_id || null) }

    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' })
    }

    values.push(dept.id)
    await db.run(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`, values)

    const updated = await db.get('SELECT * FROM departments WHERE id = ?', [dept.id])
    return res.json({ code: 200, message: '部门已更新', data: updated })
  } catch (err) {
    console.error('Update department error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/org/departments/:id
router.delete('/departments/:id', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const orgId = req.user.org_id

    const dept = await db.get('SELECT * FROM departments WHERE id = ? AND org_id = ?', [req.params.id, orgId])
    if (!dept) {
      return res.status(404).json({ code: 404, message: '部门不存在' })
    }

    await db.run('UPDATE users SET dept_id = NULL WHERE dept_id = ?', [dept.id])
    await db.run('UPDATE departments SET parent_id = ? WHERE parent_id = ?', [dept.parent_id, dept.id])
    await db.run('DELETE FROM departments WHERE id = ?', [dept.id])

    return res.json({ code: 200, message: '部门已删除' })
  } catch (err) {
    console.error('Delete department error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/org/documents
router.get('/documents', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, search } = req.query
    const orgId = req.user.org_id

    const conditions = ['d.org_id = ?', 'd.deleted_at IS NULL']
    const params = [orgId]

    if (status) { conditions.push('d.status = ?'); params.push(status) }
    if (search) {
      conditions.push('(d.title LIKE ? OR d.content LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const countRow = await db.get(`SELECT COUNT(*) as count FROM documents d ${where}`, params)
    const total = countRow.count

    const docs = await db.all(`
      SELECT d.id, d.title, d.status, d.visibility, d.owner_id, d.word_count,
             d.current_version, d.created_at, d.updated_at,
             u.username as owner_username
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      ${where}
      ORDER BY d.updated_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(docs, total, page, limit) })
  } catch (err) {
    console.error('List org documents error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/org/audit
router.get('/audit', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const orgId = req.user.org_id

    const orgMemberIds = (await db.all('SELECT id FROM users WHERE org_id = ?', [orgId])).map(u => u.id)
    if (orgMemberIds.length === 0) {
      return res.json({ code: 200, message: 'success', data: paginatedResponse([], 0, 1, limit) })
    }

    const placeholders = orgMemberIds.map(() => '?').join(',')
    const countRow = await db.get(`SELECT COUNT(*) as count FROM audit_logs WHERE actor_id IN (${placeholders})`, orgMemberIds)
    const total = countRow.count

    const logs = await db.all(`
      SELECT al.*, u.username as actor_username
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.actor_id IN (${placeholders})
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...orgMemberIds, limit, offset])

    return res.json({ code: 200, message: 'success', data: paginatedResponse(logs, total, page, limit) })
  } catch (err) {
    console.error('Org audit error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/org/stats
router.get('/stats', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const orgId = req.user.org_id

    const [memberCount, docCount, publishedDocCount, deptCount, versionCount, org] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM users WHERE org_id = ?', [orgId]),
      db.get('SELECT COUNT(*) as count FROM documents WHERE org_id = ? AND deleted_at IS NULL', [orgId]),
      db.get("SELECT COUNT(*) as count FROM documents WHERE org_id = ? AND status = 'published' AND deleted_at IS NULL", [orgId]),
      db.get('SELECT COUNT(*) as count FROM departments WHERE org_id = ?', [orgId]),
      db.get('SELECT COUNT(*) as count FROM document_versions dv INNER JOIN documents d ON dv.document_id = d.id WHERE d.org_id = ?', [orgId]),
      db.get('SELECT id, name, slug, description, logo_url, created_at FROM orgs WHERE id = ?', [orgId])
    ])

    return res.json({
      code: 200,
      message: 'success',
      data: {
        org,
        stats: {
          member_count: memberCount.count,
          document_count: docCount.count,
          published_document_count: publishedDocCount.count,
          department_count: deptCount.count,
          version_count: versionCount.count
        }
      }
    })
  } catch (err) {
    console.error('Org stats error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/org/settings
router.put('/settings', async (req, res) => {
  if (!ensureOrgContext(req, res)) return
  try {
    const { name, description, logo_url, settings } = req.body
    const orgId = req.user.org_id

    const updates = ['updated_at = CURRENT_TIMESTAMP']
    const values = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url) }
    if (settings !== undefined) { updates.push('settings = ?'); values.push(JSON.stringify(settings)) }

    values.push(orgId)
    await db.run(`UPDATE orgs SET ${updates.join(', ')} WHERE id = ?`, values)

    const org = await db.get('SELECT id, name, slug, description, logo_url, settings, created_at, updated_at FROM orgs WHERE id = ?', [orgId])
    const parsedOrg = {
      ...org,
      settings: (() => { try { return JSON.parse(org.settings || '{}') } catch { return {} } })()
    }

    return res.json({ code: 200, message: '组织设置已更新', data: parsedOrg })
  } catch (err) {
    console.error('Update org settings error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
