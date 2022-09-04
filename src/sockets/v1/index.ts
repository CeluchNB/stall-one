import { Socket } from 'socket.io'
import registerActionHandler from './action'
import registerCommentHandler from './comment'
import { createClient } from 'redis'
import { RedisClientType } from '../../types/action'

export let client: RedisClientType
const socketHandler = async (socket: Socket) => {
    client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
    socket.join('servers')

    registerActionHandler(socket, client)
    registerCommentHandler(socket, client)
}

export default socketHandler
