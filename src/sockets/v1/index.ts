import { Server, Socket } from 'socket.io'
import registerActionHandler from './action'
import { RedisClientType } from '../../types/action'
import { UltmtLogger } from '../../logging'

const socketHandler = (client: RedisClientType, io: Server, logger: UltmtLogger) => {
    return (socket: Socket) => {
        socket.join('servers')
        registerActionHandler(socket, client, io, logger)
    }
}

export default socketHandler
