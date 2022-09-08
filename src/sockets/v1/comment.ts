import { Comment, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'

const commentHandler = (data: Comment, client: RedisClientType) => {
    // save to redis
    // send data (full point) to users
    // save to mongodb
}

const serverCommentHandler = (client: RedisClientType) => {
    // send data to users
}

const registerCommentHandler = (socket: Socket, client: RedisClientType) => {
    socket.on('comment:client', (data) => {
        commentHandler(data, client)
        socket.to('servers').emit('comment:server')
    })

    socket.on('comment:server', () => {
        serverCommentHandler(client)
    })
}

export default registerCommentHandler
