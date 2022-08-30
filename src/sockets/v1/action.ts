import { ClientAction, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'

const actionHandler = async (data: ClientAction, client: RedisClientType) => {
    const services = new ActionServices(client)
    await services.createRedisAction(data)
}

const serverActionHandler = (client: RedisClientType) => {
    // Send action to client
}

const registerActionHandlers = (socket: Socket, client: RedisClientType) => {
    socket.on('action:client', async (data) => {
        const dataJson = JSON.parse(data)
        await actionHandler(dataJson, client)
    })
    socket.on('action:server', () => {
        serverActionHandler(client)
    })
}

export default registerActionHandlers
