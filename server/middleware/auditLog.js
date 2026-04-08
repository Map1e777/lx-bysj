const { db } = require('../db')

function auditLog(action) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = (data) => {
      if (res.statusCode < 400) {
        const resourceId = req.params.id || req.params.docId || req.params.uid || ''
        const resourceType = resourceId
          ? (req.baseUrl.includes('documents') ? 'document'
            : req.baseUrl.includes('users') ? 'user'
            : req.baseUrl.includes('orgs') ? 'org'
            : 'resource')
          : 'system'

        db.run(
          'INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user?.id || null, action, resourceType, String(resourceId), req.ip || '', req.headers['user-agent'] || '']
        ).catch(e => console.error('Audit log error:', e.message))
      }
      return originalJson(data)
    }
    next()
  }
}

module.exports = { auditLog }
