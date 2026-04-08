const { db } = require('../db')
const { getIO } = require('../wsServer')

async function createNotification(userId, type, payload) {
  const result = await db.run(
    'INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)',
    [userId, type, JSON.stringify(payload)]
  )

  const io = getIO()
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', {
      id: result.insertId,
      type,
      payload,
      is_read: false,
      created_at: new Date().toISOString()
    })
  }

  return result.insertId
}

module.exports = { createNotification }
