const express = require('express')
const router = express.Router({ mergeParams: true })
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const { db } = require('../db')
const { authenticateToken } = require('../middleware/auth')
const { requireDocPermission } = require('../middleware/permissions')

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const docDir = path.join(uploadDir, `doc_${req.params.id}`)
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true })
    }
    cb(null, docDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'application/zip', 'application/x-zip-compressed'
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`))
    }
  }
})

// GET /api/documents/:id/attachments
router.get('/:id/attachments', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const attachments = await db.all(`
      SELECT a.id, a.filename, a.original_name, a.mime_type, a.file_size, a.created_at,
             u.username as uploader_username
      FROM attachments a
      LEFT JOIN users u ON a.uploader_id = u.id
      WHERE a.document_id = ?
      ORDER BY a.created_at DESC
    `, [req.params.id])

    return res.json({ code: 200, message: 'success', data: attachments })
  } catch (err) {
    console.error('List attachments error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// POST /api/documents/:id/attachments
router.post('/:id/attachments', authenticateToken, requireDocPermission('write'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 400, message: '文件大小超出限制' })
      }
      return res.status(400).json({ code: 400, message: err.message || '文件上传失败' })
    }

    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的文件' })
    }

    try {
      const relPath = path.relative(path.resolve('./'), req.file.path).replace(/\\/g, '/')

      const result = await db.run(
        'INSERT INTO attachments (document_id, uploader_id, filename, original_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, req.user.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, relPath]
      )

      const attachment = await db.get(`
        SELECT a.*, u.username as uploader_username
        FROM attachments a LEFT JOIN users u ON a.uploader_id = u.id
        WHERE a.id = ?
      `, [result.insertId])

      return res.status(201).json({ code: 201, message: '文件上传成功', data: attachment })
    } catch (dbErr) {
      console.error('Save attachment error:', dbErr)
      return res.status(500).json({ code: 500, message: '服务器错误' })
    }
  })
})

// DELETE /api/documents/:id/attachments/:aid
router.delete('/:id/attachments/:aid', authenticateToken, requireDocPermission('write'), async (req, res) => {
  try {
    const attachment = await db.get('SELECT * FROM attachments WHERE id = ? AND document_id = ?', [req.params.aid, req.params.id])

    if (!attachment) {
      return res.status(404).json({ code: 404, message: '附件不存在' })
    }

    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id])
    const canDelete = attachment.uploader_id === req.user.id ||
      (doc && doc.owner_id === req.user.id) ||
      req.user.system_role === 'system_admin'

    if (!canDelete) {
      return res.status(403).json({ code: 403, message: '无权删除此附件' })
    }

    try {
      const filePath = path.resolve(attachment.file_path)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (fileErr) {
      console.warn('Could not delete file:', fileErr.message)
    }

    await db.run('DELETE FROM attachments WHERE id = ?', [attachment.id])

    return res.json({ code: 200, message: '附件已删除' })
  } catch (err) {
    console.error('Delete attachment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// GET /api/documents/:id/attachments/:aid/download
router.get('/:id/attachments/:aid/download', authenticateToken, requireDocPermission('read'), async (req, res) => {
  try {
    const attachment = await db.get('SELECT * FROM attachments WHERE id = ? AND document_id = ?', [req.params.aid, req.params.id])

    if (!attachment) {
      return res.status(404).json({ code: 404, message: '附件不存在' })
    }

    const filePath = path.resolve(attachment.file_path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 404, message: '文件不存在' })
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.original_name)}"`)
    res.setHeader('Content-Type', attachment.mime_type)
    return res.sendFile(filePath)
  } catch (err) {
    console.error('Download attachment error:', err)
    return res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

module.exports = router
