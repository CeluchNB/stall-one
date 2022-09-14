import * as Constants from '../../utils/constants'
import IAction, { ClientAction, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'
import { ApiError } from '../../types/errors'
import { handleSocketError } from '../../utils/utils'
import { gameAuth } from '../../middlware/socket-game-auth'

const actionHandler = async (data: ClientAction, gameId: string, client: RedisClientType): Promise<IAction> => {
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.createLiveAction(data, gameId)
}

const serverActionHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number },
): Promise<IAction> => {
    const { pointId, actionNumber } = data
    if (!pointId || !actionNumber) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.getLiveAction(pointId, actionNumber)
}

const commentHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number; comment: string; jwt: string },
): Promise<IAction> => {
    const { pointId, actionNumber, comment, jwt } = data
    if (!pointId || !actionNumber || !comment || !jwt) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.addComment(pointId, actionNumber, { comment, jwt })
}

const registerActionHandlers = (socket: Socket, client: RedisClientType) => {
    socket.on('action', async (data) => {
        try {
            gameAuth(socket, (err) => {
                if (err) {
                    throw err
                }
            })
            const { gameId } = socket.data
            const dataJson = JSON.parse(data)
            const action = await actionHandler(dataJson, gameId, client)
            // send action to client
            socket.emit('action:client', action)
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
            // send action to client
            socket.emit('action:client', action)
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })

    socket.on('action:comment', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const action = await commentHandler(client, dataJson)
            socket.emit('action:client', action)
            socket.to('servers').emit('action:server', { pointId: action.pointId, number: action.actionNumber })
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })
}

export default registerActionHandlers
