const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireDocPermission } = require('../middleware/permissions')
const { createNotification } = require('../services/notificationService')
const { parsePagination, paginatedResponse } = require('../utils/pagination')

// ===== Collaborator endpoints (mounted on /api/documents) =====

// GET /api/documents/:id/collaborators
router.get('/:id/collaborators', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const collaborators = await db.all(`
      SELECT dp.id, dp.user_id, dp.role, dp.granted_at, dp.expires_at,
             u.username, u.email, u.avatar_url,
             g.username as granted_by_username
      FROM document_permissions dp
      LEFT JOIN users u ON dp.user_id = u.id
      LEFT JOIN users g ON dp.granted_by = g.id
      WHERE dp.document_id = ?
      ORDER BY dp.granted_at ASC
    `, [req.params.id])

    return res.json({
      code: 200,
      message: 'success',
      data: collaborators.map(collab => ({
        ...collab,
        is_owner: collab.role === 'creator'
      }))
    })
  } catch (err) {
    console.error('List collaborators error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/collaborators/invite
router.post('/:id/collaborators/invite', authenticateToken, requireDocPermission('manage'), async (req, res) => {
  try {
    const { email, role = 'viewer', expires_in_days } = req.body
    const docId = req.params.id

    if (!email) {
      return res.status(400).json({ code: 400, message: '邮箱不能为空' })
    }

    const validRoles = ['editor', 'commenter', 'viewer']
    if (!validRoles.includes(role)) {
        return res.status(400).json({ code: 400, message: '无效的角色，可选值: editor, commenter, viewer' })
    }

    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId])
    const invitee = await db.get('SELECT id FROM users WHERE email = ?', [email])

    if (invitee) {
      const existing = await db.get('SELECT id FROM document_permissions WHERE document_id = ? AND user_id = ?', [docId, invitee.id])
      if (existing) {
        return res.status(409).json({ code: 409, message: '该用户已有文档访问权限' })
      }
    }

    const pendingInvite = await db.get(
      "SELECT id FROM invitations WHERE document_id = ? AND invitee_email = ? AND status = 'pending'",
      [docId, email]
    )
    if (pendingInvite) {
      return res.status(409).json({ code: 409, message: '该邮箱已有待处理的邀请' })
    }

    const token = uuidv4()
    const exp = new Date()
    exp.setDate(exp.getDate() + (expires_in_days && parseInt(expires_in_days) > 0 ? parseInt(expires_in_days) : 7))

    const result = await db.run(
      "INSERT INTO invitations (document_id, inviter_id, invitee_email, invitee_id, role, token, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
      [docId, req.user.id, email, invitee?.id || null, role, token, exp]
    )
    const expiresAt = exp.toISOString()

    if (invitee) {
      await createNotification(invitee.id, 'invitation.received', {
        invitation_id: result.insertId,
        document_id: parseInt(docId),
        document_title: doc?.title || '',
        inviter: req.user.username,
        role,
        token
      })
    }

    return res.status(201).json({
      code: 201,
      message: '邀请已发送',
      data: { invitation_id: result.insertId, token, email, role, expires_at: expiresAt }
    })
  } catch (err) {
    console.error('Invite collaborator error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// DELETE /api/documents/:id/collaborators/:userId
router.delete('/:id/collaborators/:userId', authenticateToken, requireDocPermission('manage'), async (req, res) => {
  try {
    const docId = req.params.id
    const targetUserId = req.params.userId

    const perm = await db.get('SELECT * FROM document_permissions WHERE document_id = ? AND user_id = ?', [docId, targetUserId])
    if (!perm) {
      return res.status(404).json({ code: 404, message: '协作者不存在' })
    }

    if (perm.role === 'creator') {
      return res.status(400).json({ code: 400, message: '不能移除文档创建者' })
    }

    await db.run('DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?', [docId, targetUserId])

    await createNotification(parseInt(targetUserId), 'collaboration.removed', {
      document_id: parseInt(docId),
      removed_by: req.user.username
    })

    return res.json({ code: 200, message: '协作者已移除' })
  } catch (err) {
    console.error('Remove collaborator error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/documents/:id/collaborators/:userId
router.put('/:id/collaborators/:userId', authenticateToken, requireDocPermission('manage'), async (req, res) => {
  try {
    const { role } = req.body
    const docId = req.params.id
    const targetUserId = req.params.userId

    const validRoles = ['editor', 'commenter', 'viewer']
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ code: 400, message: '无效的角色，可选值: editor, commenter, viewer' })
    }

    const perm = await db.get('SELECT * FROM document_permissions WHERE document_id = ? AND user_id = ?', [docId, targetUserId])
    if (!perm) {
      return res.status(404).json({ code: 404, message: '协作者不存在' })
    }

    if (perm.role === 'creator') {
      return res.status(400).json({ code: 400, message: '不能修改文档创建者的角色' })
    }

    await db.run('UPDATE document_permissions SET role = ? WHERE document_id = ? AND user_id = ?', [role, docId, targetUserId])

    const updated = await db.get(`
      SELECT dp.*, u.username, u.email, u.avatar_url
      FROM document_permissions dp
      LEFT JOIN users u ON dp.user_id = u.id
      WHERE dp.document_id = ? AND dp.user_id = ?
    `, [docId, targetUserId])

    return res.json({ code: 200, message: '角色已更新', data: updated })
  } catch (err) {
    console.error('Change collaborator role error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// ===== Invitation endpoints (mounted on /api/invitations) =====

// GET /api/invitations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status = 'pending' } = req.query

    const countRow = await db.get(`
      SELECT COUNT(*) as count
      FROM invitations i
      WHERE (i.invitee_email = ? OR i.invitee_id = ?) AND i.status = ?
    `, [req.user.email, req.user.id, status])

    const invitations = await db.all(`
      SELECT i.id, i.document_id, i.role, i.token, i.status, i.created_at, i.expires_at, i.responded_at,
             d.title as document_title,
             u.username as inviter_username, u.username as inviter_name, u.avatar_url as inviter_avatar
      FROM invitations i
      LEFT JOIN documents d ON i.document_id = d.id
      LEFT JOIN users u ON i.inviter_id = u.id
      WHERE (i.invitee_email = ? OR i.invitee_id = ?) AND i.status = ?
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.email, req.user.id, status, limit, offset])

    return res.json({
      code: 200,
      message: 'success',
      data: paginatedResponse(invitations, countRow.count, page, limit)
    })
  } catch (err) {
    console.error('List invitations error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/invitations/:token/accept
router.post('/:token/accept', authenticateToken, async (req, res) => {
  try {
    const invitation = await db.get('SELECT * FROM invitations WHERE token = ?', [req.params.token])

    if (!invitation) {
      return res.status(404).json({ code: 404, message: '邀请不存在' })
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '邀请已处理' })
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await db.run("UPDATE invitations SET status = 'expired' WHERE id = ?", [invitation.id])
      return res.status(400).json({ code: 400, message: '邀请已过期' })
    }

    if (invitation.invitee_email !== req.user.email && invitation.invitee_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '此邀请不属于您' })
    }

    const existing = await db.get('SELECT id FROM document_permissions WHERE document_id = ? AND user_id = ?', [invitation.document_id, req.user.id])

    await db.transaction(async (conn) => {
      if (!existing) {
        await conn.query(
          'INSERT INTO document_permissions (document_id, user_id, role, granted_by) VALUES (?, ?, ?, ?)',
          [invitation.document_id, req.user.id, invitation.role, invitation.inviter_id]
        )
      }
      await conn.query(
        "UPDATE invitations SET status = 'accepted', invitee_id = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?",
        [req.user.id, invitation.id]
      )
    })

    await createNotification(invitation.inviter_id, 'invitation.accepted', {
      document_id: invitation.document_id,
      invitee: req.user.username,
      role: invitation.role
    })

    const doc = await db.get('SELECT id, title FROM documents WHERE id = ?', [invitation.document_id])
    return res.json({
      code: 200,
      message: '邀请已接受',
      data: { document: doc, role: invitation.role }
    })
  } catch (err) {
    console.error('Accept invitation error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/invitations/:token/decline
router.post('/:token/decline', authenticateToken, async (req, res) => {
  try {
    const invitation = await db.get('SELECT * FROM invitations WHERE token = ?', [req.params.token])

    if (!invitation) {
      return res.status(404).json({ code: 404, message: '邀请不存在' })
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '邀请已处理' })
    }

    if (invitation.invitee_email !== req.user.email && invitation.invitee_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '此邀请不属于您' })
    }

    await db.run(
      "UPDATE invitations SET status = 'declined', invitee_id = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.user.id, invitation.id]
    )

    await createNotification(invitation.inviter_id, 'invitation.declined', {
      document_id: invitation.document_id,
      invitee: req.user.username
    })

    return res.json({ code: 200, message: '邀请已拒绝' })
  } catch (err) {
    console.error('Decline invitation error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
