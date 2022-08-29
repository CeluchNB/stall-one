import { Socket } from 'socket.io'
import actionHandler from './action'
import commentHandler from './comment'

const socketHandler = (socket: Socket) => {
    socket.join('servers')

    // Handle stat keeper logging action
    socket.on('action', (data) => {
        socket.to('servers').emit('serverAction', data)
        actionHandler(data)
    })
    socket.on('serverAction', actionHandler)

    // Handle fan logging comment for action
    socket.on('comment', (data) => {
        socket.to('servers').emit('serverComment', data)
        commentHandler(data)
    })
    socket.on('serverComment', commentHandler)
}

export default socketHandler
