import { Socket } from 'socket.io'
import registerActionHandler from './action'
import registerCommentHandler from './comment'
import { createClient } from 'redis'

const socketHandler = async (socket: Socket) => {
    const client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
    socket.join('servers')

    registerActionHandler(socket, client)
    registerCommentHandler(socket, client)
}

export default socketHandler
