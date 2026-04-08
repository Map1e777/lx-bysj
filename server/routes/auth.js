const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { hashPassword, comparePassword } = require('../utils/hash')
const { signToken } = require('../utils/jwt')
const { authenticateToken } = require('../middleware/auth')

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ code: 400, message: '用户名、邮箱和密码不能为空' })
    }
    if (username.length < 2 || username.length > 50) {
      return res.status(400).json({ code: 400, message: '用户名长度应在2-50字符之间' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ code: 400, message: '邮箱格式不正确' })
    }
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码长度不能少于6位' })
    }

    const existingUser = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
    if (existingUser) {
      return res.status(409).json({ code: 409, message: '用户名或邮箱已被占用' })
    }

    const regConfig = await db.get('SELECT value FROM system_config WHERE `key` = ?', ['allow_registration'])
    if (regConfig && JSON.parse(regConfig.value) === false) {
      return res.status(403).json({ code: 403, message: '系统当前不允许注册' })
    }

    const passwordHash = await hashPassword(password)

    const result = await db.run(
      "INSERT INTO users (username, email, password_hash, system_role, is_active) VALUES (?, ?, ?, 'user', 1)",
      [username, email, passwordHash]
    )

    const user = await db.get(
      'SELECT id, username, email, system_role, org_id, org_role, avatar_url, created_at FROM users WHERE id = ?',
      [result.insertId]
    )

    const token = signToken({ id: user.id, username: user.username, email: user.email })

    return res.status(201).json({
      code: 201,
      message: '注册成功',
      data: { token, user }
    })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ code: 400, message: '邮箱和密码不能为空' })
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email])
    if (!user) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误' })
    }

    if (!user.is_active) {
      return res.status(401).json({ code: 401, message: '账号已被停用，请联系管理员' })
    }

    const passwordMatch = await comparePassword(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误' })
    }

    await db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id])

    const token = signToken({ id: user.id, username: user.username, email: user.email })

    const { password_hash, ...safeUser } = user
    safeUser.last_login_at = new Date().toISOString()

    return res.json({
      code: 200,
      message: '登录成功',
      data: { token, user: safeUser }
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, username, email, system_role, org_id, org_role, avatar_url, dept_id, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    )

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    return res.json({ code: 200, message: 'success', data: user })
  } catch (err) {
    console.error('Get me error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// PUT /api/auth/password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ code: 400, message: '旧密码和新密码不能为空' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ code: 400, message: '新密码长度不能少于6位' })
    }

    const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id])

    const match = await comparePassword(oldPassword, user.password_hash)
    if (!match) {
      return res.status(400).json({ code: 400, message: '旧密码不正确' })
    }

    const newHash = await hashPassword(newPassword)
    await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id])

    return res.json({ code: 200, message: '密码修改成功' })
  } catch (err) {
    console.error('Change password error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
