import { Socket } from 'socket.io'

const socketHandler = (socket: Socket) => {
    socket.on('action', () => {
        console.log('got an action')
    })
}

export default socketHandler
