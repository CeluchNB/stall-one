import { Socket } from 'socket.io'
import registerActionHandler from './action'
import { RedisClientType } from '../../types/action'

const socketHandler = (client: RedisClientType) => {
    return (socket: Socket) => {
        socket.join('servers')

        registerActionHandler(socket, client)
    }
}

export default socketHandler
