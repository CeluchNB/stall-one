import IAction, { ClientAction, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'

const actionHandler = async (data: ClientAction, gameId: string, client: RedisClientType): Promise<IAction> => {
    const services = new ActionServices(client)
    const action = await services.createRedisAction(data, gameId)
    return await services.getRedisAction(action.pointId.toString(), action.actionNumber)
}

const serverActionHandler = async (
    client: RedisClientType,
    data: { pointId: string; number: number },
): Promise<IAction> => {
    // Send action to client
    const { pointId, number } = data
    const services = new ActionServices(client)
    return await services.getRedisAction(pointId, number)
}

const registerActionHandlers = (socket: Socket, client: RedisClientType) => {
    socket.join('servers')
    socket.on('action:client', async (data) => {
        const { gameId } = socket.data
        const dataJson = JSON.parse(data)
        const action = await actionHandler(dataJson, gameId, client)
        socket.emit('action', action)
        socket.to('servers').emit('action:server', { pointId: action.pointId, number: action.actionNumber })
    })
    socket.on('action:server', async (data) => {
        const dataJson = JSON.parse(data)
        const action = await serverActionHandler(client, dataJson)
        socket.emit('action', action)
    })
}

export default registerActionHandlers
