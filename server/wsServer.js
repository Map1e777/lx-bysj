const { Server } = require('socket.io')
const { verifyToken } = require('./utils/jwt')

let io

function initializeSocketIO(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('Authentication required'))
    try {
      const user = verifyToken(token)
      socket.user = user
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.user.id
    socket.join(`user:${userId}`)
    console.log(`User ${userId} connected`)

    socket.on('join:document', (docId) => {
      socket.join(`doc:${docId}`)
      socket.to(`doc:${docId}`).emit('doc:user_joined', {
        userId,
        username: socket.user.username
      })
    })

    socket.on('leave:document', (docId) => {
      socket.leave(`doc:${docId}`)
      socket.to(`doc:${docId}`).emit('doc:user_left', {
        userId,
        username: socket.user.username
      })
    })

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`)
    })
  })

  return io
}

function getIO() {
  return io
}

module.exports = { initializeSocketIO, getIO }
