require('dotenv').config()
const http = require('http')
const app = require('./app')
const { initializeSocketIO } = require('./wsServer')
const { initDB } = require('./db')

const PORT = process.env.PORT || 3000

async function start() {
  // Initialize database
  await initDB()

  const server = http.createServer(app)

  // Initialize Socket.io
  initializeSocketIO(server)

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch(console.error)
