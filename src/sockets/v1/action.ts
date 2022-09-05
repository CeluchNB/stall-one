import * as Constants from '../../utils/constants'
import IAction, { ClientAction, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'
import { ApiError } from '../../types/errors'
import { handleSocketError } from '../../utils/utils'

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
    if (!pointId || !number) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
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
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })
    socket.on('action:server', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const action = await serverActionHandler(client, dataJson)
            socket.emit('action', action)
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })
}

export default registerActionHandlers
