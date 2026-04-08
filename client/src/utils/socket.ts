import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function initSocket(token: string): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io('http://localhost:3000', {
    auth: { token },
    transports: ['websocket']
  })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
