require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const path = require('path')

const authRoutes = require('./routes/auth')
const usersRoutes = require('./routes/users')
const documentsRoutes = require('./routes/documents')
const versionsRoutes = require('./routes/versions')
const commentsRoutes = require('./routes/comments')
const attachmentsRoutes = require('./routes/attachments')
const collaborationRoutes = require('./routes/collaboration')
const notificationsRoutes = require('./routes/notifications')
const searchRoutes = require('./routes/search')
const orgRoutes = require('./routes/org')
const adminRoutes = require('./routes/admin')

const app = express()

// Security headers
app.use(helmet())

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

// Body parsers
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试' }
})
app.use(limiter)

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Mount routes
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/documents', documentsRoutes)
app.use('/api/documents', versionsRoutes)
app.use('/api/documents', commentsRoutes)
app.use('/api/documents', attachmentsRoutes)
app.use('/api/documents', collaborationRoutes)
app.use('/api/invitations', collaborationRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/org', orgRoutes)
app.use('/api/admin', adminRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    code: status,
    message: err.message || '服务器内部错误'
  })
})

module.exports = app
