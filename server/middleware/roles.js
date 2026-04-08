function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, message: '未授权' })
    const userRoles = [req.user.system_role, req.user.org_role].filter(Boolean)
    const hasRole = roles.some(r => userRoles.includes(r) || req.user.system_role === 'system_admin')
    if (!hasRole) return res.status(403).json({ code: 403, message: '权限不足' })
    next()
  }
}

module.exports = { requireRole }
