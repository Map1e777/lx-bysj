const { verifyToken } = require('../utils/jwt')
const { db } = require('../db')

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ code: 401, message: '未授权，请先登录' })

  try {
    const decoded = verifyToken(token)
    const user = await db.get('SELECT id, username, email, system_role, org_id, org_role, is_active FROM users WHERE id = ?', [decoded.id])
    if (!user || !user.is_active) return res.status(401).json({ code: 401, message: '账号已停用' })
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ code: 401, message: 'Token无效或已过期' })
  }
}

module.exports = { authenticateToken }
