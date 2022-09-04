import IAction, { ClientAction, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'
import { userErrorResponse } from '../../middlware/errors'

const actionHandler = async (data: ClientAction, gameId: string, client: RedisClientType): Promise<IAction> => {
    const services = new ActionServices(client)
    return await services.createLiveAction(data, gameId)
}

const serverActionHandler = async (
    client: RedisClientType,
    data: { pointId: string; number: number },
): Promise<IAction> => {
    // Send action to client
    const { pointId, number } = data
    const services = new ActionServices(client)
    return await services.getLiveAction(pointId, number)
}

const registerActionHandlers = (socket: Socket, client: RedisClientType) => {
    socket.on('action:client', async (data) => {
        try {
            const { gameId } = socket.data
            const dataJson = JSON.parse(data)
            const action = await actionHandler(dataJson, gameId, client)
            socket.emit('action', action)
            socket.to('servers').emit('action:server', { pointId: action.pointId, number: action.actionNumber })
        } catch (error) {
            if (typeof error === 'object' && error) {
                const errorData = userErrorResponse(error.toString())
                socket.emit('action:error', errorData)
            } else {
                socket.emit('action:error')
            }
        }
    })
    socket.on('action:server', async (data) => {
        const dataJson = JSON.parse(data)
        const action = await serverActionHandler(client, dataJson)
        socket.emit('action', action)
    })
}

export default registerActionHandlers
