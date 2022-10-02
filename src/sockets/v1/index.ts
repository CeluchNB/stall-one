import { Server, Socket } from 'socket.io'
import registerActionHandler from './action'
import { RedisClientType } from '../../types/action'

const socketHandler = (client: RedisClientType, io: Server) => {
    return (socket: Socket) => {
        socket.join('servers')
        registerActionHandler(socket, client, io)
    }
}

export default socketHandler
